import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO, {
    CreateCurriculumSuggestionBody,
    ListCurriculumSuggestionsQuery,
    PatchCurriculumSuggestionBody
} from "#/modules/catalog/contracts/CurriculumSuggestionInterface.js";
import curriculumSuggestionEntity from "#/modules/catalog/controllers/CurriculumSuggestionController/Entity.js";
import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { ValidationError } from "@pomi/api-core";
import { CurriculumSuggestionType, Prisma } from "@pomi/db";
import { Router } from "express";
import z from "zod";

extendZodWithOpenApi(z);

function alreadyExistsError() {
    return new ValidationError([
        {
            code: "ALREADY_EXISTS",
            path: ["body", "code"],
            message:
                "A curriculum suggestion with this code already exists for this catalog program"
        }
    ]);
}

function referenceNotFoundError(path: string[], message: string) {
    return new ValidationError([
        {
            code: "REFERENCE_NOT_FOUND",
            path,
            message
        }
    ]);
}

function invalidValueError(path: string[], message: string) {
    return new ValidationError([
        {
            code: "INVALID_VALUE",
            path,
            message
        }
    ]);
}

async function validateSpecializationReference(
    prisma: {
        catalogSpecialization: {
            findFirst(args: {
                where: { catalogProgramId: number; specializationId: number };
                select: { id: true };
            }): Promise<{ id: number } | null>;
        };
    },
    catalogProgramId: number,
    type: CurriculumSuggestionType,
    specializationId: number | null | undefined
) {
    if (type !== CurriculumSuggestionType.SPECIALIZATION) {
        if (specializationId != null)
            return {
                error: invalidValueError(
                    ["body", "specializationId"],
                    "specializationId is only allowed for SPECIALIZATION suggestions"
                )
            };
        return { catalogSpecializationId: null };
    }

    if (specializationId == null)
        return {
            error: new ValidationError([
                {
                    code: "REQUIRED",
                    path: ["body", "specializationId"],
                    message:
                        "specializationId is required for SPECIALIZATION suggestions"
                }
            ])
        };

    const catalogSpecialization = await prisma.catalogSpecialization.findFirst({
        where: { catalogProgramId, specializationId },
        select: { id: true }
    });
    if (!catalogSpecialization)
        return {
            error: referenceNotFoundError(
                ["body", "specializationId"],
                "Specialization is not available for this catalog program"
            )
        };
    return { catalogSpecializationId: catalogSpecialization.id };
}

function nestedSemesters(
    semesters:
        | CreateCurriculumSuggestionBody["semesters"]
        | NonNullable<PatchCurriculumSuggestionBody["semesters"]>
) {
    return semesters.map((semester) => ({
        semester: semester.semester,
        electiveCredits: semester.electiveCredits,
        courses: {
            create: semester.courses.map(({ courseId }) => ({ courseId }))
        }
    }));
}

function courseIdsFromSemesters(
    semesters:
        | CreateCurriculumSuggestionBody["semesters"]
        | NonNullable<PatchCurriculumSuggestionBody["semesters"]>
) {
    return semesters.flatMap((semester) =>
        semester.courses.map(({ courseId }) => courseId)
    );
}

async function validateCourseReferences(
    prisma: {
        course: {
            findMany(args: {
                where: { id: { in: number[] } };
                select: { id: true };
            }): Promise<Array<{ id: number }>>;
        };
    },
    semesters:
        | CreateCurriculumSuggestionBody["semesters"]
        | NonNullable<PatchCurriculumSuggestionBody["semesters"]>
) {
    const courseIds = courseIdsFromSemesters(semesters);
    if (courseIds.length === 0) return undefined;
    const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true }
    });
    const persistedIds = new Set(courses.map(({ id }) => id));
    const missingIds = courseIds.filter((id) => !persistedIds.has(id));
    if (missingIds.length === 0) return undefined;
    return referenceNotFoundError(
        ["body", "semesters"],
        `Courses not found: ${missingIds.join(", ")}`
    );
}

function isPrismaError(error: unknown, code: string) {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === code
    );
}

export const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const {
        catalogProgramId,
        catalogId,
        catalogYear,
        programId,
        programCode,
        code,
        type,
        specializationId
    } = input.query;
    const hasCatalogProgramFilter =
        catalogId !== undefined ||
        catalogYear !== undefined ||
        programId !== undefined ||
        programCode !== undefined;
    const suggestions = await ctx.prisma.curriculumSuggestion.findMany({
        ...curriculumSuggestionEntity.prismaSelection,
        where: {
            ...(catalogProgramId !== undefined ? { catalogProgramId } : {}),
            ...(code !== undefined
                ? { code: { equals: code, mode: "insensitive" } }
                : {}),
            ...(type !== undefined ? { type } : {}),
            ...(specializationId !== undefined
                ? { catalogSpecialization: { specializationId } }
                : {}),
            ...(hasCatalogProgramFilter
                ? {
                      catalogProgram: {
                          ...(catalogId !== undefined ? { catalogId } : {}),
                          ...(programId !== undefined ? { programId } : {}),
                          ...(catalogYear !== undefined
                              ? { catalog: { year: catalogYear } }
                              : {}),
                          ...(programCode !== undefined
                              ? { program: { code: programCode } }
                              : {})
                      }
                  }
                : {})
        }
    });
    const entities = suggestions.map(curriculumSuggestionEntity.build);
    entities.sort(
        (left, right) =>
            right.catalogYear - left.catalogYear ||
            left.programCode - right.programCode ||
            left.code.localeCompare(right.code)
    );
    return { 200: entities };
};

export const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const suggestion = await ctx.prisma.curriculumSuggestion.findUnique({
        ...curriculumSuggestionEntity.prismaSelection,
        where: { id: input.path.id }
    });
    if (!suggestion)
        return { 404: { description: "Curriculum suggestion not found" } };
    return { 200: curriculumSuggestionEntity.build(suggestion) };
};

export const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;
    const catalogProgram = await ctx.prisma.catalogProgram.findUnique({
        where: { id: body.catalogProgramId },
        select: { id: true }
    });
    if (!catalogProgram)
        return {
            400: referenceNotFoundError(
                ["body", "catalogProgramId"],
                "Catalog program not found"
            )
        };
    const existing = await ctx.prisma.curriculumSuggestion.findUnique({
        where: {
            catalogProgramId_code: {
                catalogProgramId: body.catalogProgramId,
                code: body.code
            }
        },
        select: { id: true }
    });
    if (existing) return { 400: alreadyExistsError() };
    const specializationValidation = await validateSpecializationReference(
        ctx.prisma,
        body.catalogProgramId,
        body.type,
        body.specializationId
    );
    if (specializationValidation.error)
        return { 400: specializationValidation.error };
    const referenceError = await validateCourseReferences(
        ctx.prisma,
        body.semesters
    );
    if (referenceError) return { 400: referenceError };

    try {
        const suggestion = await ctx.prisma.$transaction((tx) =>
            tx.curriculumSuggestion.create({
                ...curriculumSuggestionEntity.prismaSelection,
                data: {
                    catalogProgramId: body.catalogProgramId,
                    code: body.code,
                    name: body.name,
                    type: body.type,
                    catalogSpecializationId:
                        specializationValidation.catalogSpecializationId,
                    semesters: { create: nestedSemesters(body.semesters) }
                }
            })
        );
        return { 201: curriculumSuggestionEntity.build(suggestion) };
    } catch (error) {
        if (isPrismaError(error, "P2002")) return { 400: alreadyExistsError() };
        if (isPrismaError(error, "P2003"))
            return {
                400: referenceNotFoundError(
                    ["body"],
                    "Catalog program or course not found"
                )
            };
        throw error;
    }
};

export const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const { id } = input.path;
    const { body } = input;
    const current = await ctx.prisma.curriculumSuggestion.findUnique({
        where: { id },
        select: {
            id: true,
            catalogProgramId: true,
            type: true,
            catalogSpecialization: { select: { specializationId: true } }
        }
    });
    if (!current)
        return { 404: { description: "Curriculum suggestion not found" } };
    if (body.code !== undefined) {
        const duplicate = await ctx.prisma.curriculumSuggestion.findUnique({
            where: {
                catalogProgramId_code: {
                    catalogProgramId: current.catalogProgramId,
                    code: body.code
                }
            },
            select: { id: true }
        });
        if (duplicate && duplicate.id !== id)
            return { 400: alreadyExistsError() };
    }
    const type = body.type ?? current.type;
    const specializationId =
        body.specializationId !== undefined
            ? body.specializationId
            : current.catalogSpecialization?.specializationId;
    const specializationValidation = await validateSpecializationReference(
        ctx.prisma,
        current.catalogProgramId,
        type,
        specializationId
    );
    if (specializationValidation.error)
        return { 400: specializationValidation.error };
    if (body.semesters !== undefined) {
        const referenceError = await validateCourseReferences(
            ctx.prisma,
            body.semesters
        );
        if (referenceError) return { 400: referenceError };
    }

    try {
        const suggestion = await ctx.prisma.$transaction((tx) =>
            tx.curriculumSuggestion.update({
                ...curriculumSuggestionEntity.prismaSelection,
                where: { id },
                data: {
                    ...(body.code !== undefined ? { code: body.code } : {}),
                    ...(body.name !== undefined ? { name: body.name } : {}),
                    ...(body.type !== undefined ? { type: body.type } : {}),
                    ...(body.type !== undefined ||
                    body.specializationId !== undefined
                        ? {
                              catalogSpecializationId:
                                  specializationValidation.catalogSpecializationId
                          }
                        : {}),
                    ...(body.semesters !== undefined
                        ? {
                              semesters: {
                                  deleteMany: {},
                                  create: nestedSemesters(body.semesters)
                              }
                          }
                        : {})
                }
            })
        );
        return { 200: curriculumSuggestionEntity.build(suggestion) };
    } catch (error) {
        if (isPrismaError(error, "P2002")) return { 400: alreadyExistsError() };
        if (isPrismaError(error, "P2003"))
            return {
                400: referenceNotFoundError(
                    ["body", "semesters"],
                    "One or more courses not found"
                )
            };
        if (isPrismaError(error, "P2025"))
            return {
                404: { description: "Curriculum suggestion not found" }
            };
        throw error;
    }
};

export const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const { id } = input.path;
    const existing = await ctx.prisma.curriculumSuggestion.findUnique({
        where: { id },
        select: { id: true }
    });
    if (!existing)
        return { 404: { description: "Curriculum suggestion not found" } };
    try {
        await ctx.prisma.curriculumSuggestion.delete({ where: { id } });
        return { 204: null };
    } catch (error) {
        if (isPrismaError(error, "P2025"))
            return {
                404: { description: "Curriculum suggestion not found" }
            };
        throw error;
    }
};

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/curriculum-suggestions");
authRegistry.addException("GET", "/curriculum-suggestions/:id");

router.get(
    "/curriculum-suggestions",
    buildHandler(IO.list.input, IO.list.output, listFn)
);
router.get(
    "/curriculum-suggestions/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);
router.post(
    "/curriculum-suggestions",
    buildHandler(IO.create.input, IO.create.output, createFn)
);
router.patch(
    "/curriculum-suggestions/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);
router.delete(
    "/curriculum-suggestions/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

export function entityPath(id: number) {
    return `/curriculum-suggestions/${id}`;
}

export function listPath(query: Partial<ListCurriculumSuggestionsQuery> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
    }
    const search = params.toString();
    return `/curriculum-suggestions${search ? `?${search}` : ""}`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    },
    entity: curriculumSuggestionEntity
};
