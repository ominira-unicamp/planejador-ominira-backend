import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO from "#/modules/planning/contracts/students/PeriodPlanInterface.js";
import periodPlanningEntity from "#/modules/planning/controllers/StudentControllers/PeriodPlanController/Entity.js";
import { ErrorFieldType, ValidationError } from "@pomi/api-core";
import { PrismaClient } from "@pomi/db";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const {
        path: { sid }
    } = input;
    const periodPlans = await ctx.prisma.periodPlanning.findMany({
        ...periodPlanningEntity.prismaSelection,
        where: { studentId: sid },
        orderBy: { updatedAt: "desc" }
    });
    const entities = periodPlans.map(periodPlanningEntity.build);
    return { 200: entities };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const {
        path: { sid, id }
    } = input;
    const periodPlanning = await ctx.prisma.periodPlanning.findFirst({
        ...periodPlanningEntity.prismaSelection,
        where: { id, studentId: sid }
    });
    if (!periodPlanning)
        return { 404: { description: "PeriodPlanning not found" } };
    return { 200: periodPlanningEntity.build(periodPlanning) };
};

type GuideInput = NonNullable<z.infer<typeof IO.create.input>["body"]["guide"]>;

function legacyGuide(curriculumId: number | null | undefined): GuideInput {
    return {
        mode: curriculumId == null ? "NONE" : "CURRICULUM",
        curriculumSource: curriculumId == null ? null : "SAVED",
        curriculumId: curriculumId ?? null,
        suggestionId: null,
        suggestionCatalogProgramId: null,
        catalogProgramId: null,
        specializationId: null,
        languageId: null,
        manualCourseIds: []
    };
}

async function validateGuide(
    prisma: PrismaClient,
    guide: GuideInput,
    studentId: number
): Promise<ValidationError | null> {
    const error = new ValidationError();
    if (guide.curriculumSource === "SAVED") {
        const curriculum =
            guide.curriculumId !== null
                ? await prisma.curriculum.findFirst({
                      where: { id: guide.curriculumId, studentId },
                      select: { id: true }
                  })
                : undefined;
        if (guide.curriculumId !== null && !curriculum) {
            error.addError({
                path: ["body", "guide", "curriculumId"],
                code: "REFERENCE_NOT_FOUND",
                message: "The saved curriculum does not belong to this student"
            });
        }
        if (guide.suggestionId !== null) {
            error.addError({
                path: ["body", "guide", "suggestionId"],
                code: "INVALID_VALUE",
                message: "A saved curriculum cannot also select a suggestion"
            });
        }
    }
    if (guide.curriculumSource === "SUGGESTION") {
        const suggestion =
            guide.suggestionId !== null
                ? await prisma.curriculumSuggestion.findUnique({
                      where: { id: guide.suggestionId },
                      select: { id: true }
                  })
                : undefined;
        if (guide.suggestionId !== null && !suggestion) {
            error.addError({
                path: ["body", "guide", "suggestionId"],
                code: "REFERENCE_NOT_FOUND",
                message: "Curriculum suggestion not found"
            });
        }
        if (guide.curriculumId !== null) {
            error.addError({
                path: ["body", "guide", "curriculumId"],
                code: "INVALID_VALUE",
                message: "A suggestion cannot also select a saved curriculum"
            });
        }
    }
    if (
        guide.curriculumSource === null &&
        (guide.curriculumId !== null || guide.suggestionId !== null)
    ) {
        error.addError({
            path: ["body", "guide", "curriculumSource"],
            code: "INVALID_VALUE",
            message:
                "Curriculum source is required when a curriculum reference is selected"
        });
    }
    if (guide.catalogProgramId !== null) {
        const program = await prisma.catalogProgram.findUnique({
            where: { id: guide.catalogProgramId },
            select: { id: true }
        });
        if (!program) {
            error.addError({
                path: ["body", "guide", "catalogProgramId"],
                code: "REFERENCE_NOT_FOUND",
                message: "Catalog program not found"
            });
        }
    }
    if (guide.specializationId !== null) {
        const specialization = await prisma.catalogSpecialization.findFirst({
            where: {
                specializationId: guide.specializationId,
                ...(guide.catalogProgramId !== null
                    ? { catalogProgramId: guide.catalogProgramId }
                    : {})
            },
            select: { specializationId: true }
        });
        if (!specialization) {
            error.addError({
                path: ["body", "guide", "specializationId"],
                code: "REFERENCE_NOT_FOUND",
                message:
                    "Specialization is not available for this catalog program"
            });
        }
    }
    if (guide.languageId !== null) {
        const language = await prisma.catalogLanguage.findFirst({
            where: {
                languageId: guide.languageId,
                ...(guide.catalogProgramId !== null
                    ? { catalogProgramId: guide.catalogProgramId }
                    : {})
            },
            select: { languageId: true }
        });
        if (!language) {
            error.addError({
                path: ["body", "guide", "languageId"],
                code: "REFERENCE_NOT_FOUND",
                message: "Language is not available for this catalog program"
            });
        }
    }
    const uniqueManualCourseIds = [...new Set(guide.manualCourseIds)];
    if (uniqueManualCourseIds.length > 0) {
        const courses = await prisma.course.findMany({
            where: { id: { in: uniqueManualCourseIds } },
            select: { id: true }
        });
        if (courses.length !== uniqueManualCourseIds.length) {
            error.addError({
                path: ["body", "guide", "manualCourseIds"],
                code: "REFERENCE_NOT_FOUND",
                message: "One or more manual courses were not found"
            });
        }
    }
    return error.errors.length > 0 ? error : null;
}

async function validateClasses(
    prisma: PrismaClient,
    classIds: Set<number>,
    studyPeriodId: number,
    getPathForClassId: (classId: number) => string[]
): Promise<ValidationError | null> {
    const validationError = new ValidationError();
    validationError.addErrors(
        await validateClassesBelongToStudyPeriod(
            prisma,
            classIds,
            studyPeriodId,
            getPathForClassId
        )
    );
    validationError.addErrors(
        await validateNoDuplicateCourses(prisma, classIds, getPathForClassId)
    );
    if (validationError.errors.length > 0) {
        return validationError;
    }
    return null;
}

async function validateClassesBelongToStudyPeriod(
    prisma: PrismaClient,
    classIds: Set<number>,
    expectedStudyPeriodId: number,
    getPathForClassId: (classId: number) => string[]
): Promise<ErrorFieldType[]> {
    if (classIds.size === 0) {
        return [];
    }

    const classesData = await prisma.class.findMany({
        where: { id: { in: [...classIds] } },
        select: { id: true, studyPeriodId: true }
    });
    const error: ErrorFieldType[] = [];

    if (classesData.length !== classIds.size) {
        const notFoundIds = Array.from(classIds).filter(
            (id) => !classesData.some((c) => c.id === id)
        );
        notFoundIds.forEach((id) => {
            error.push({
                code: "REFERENCE_NOT_FOUND",
                path: getPathForClassId(id),
                message: `Class with id ${id} not found`
            });
        });
    }

    const invalidClasses = classesData.filter(
        (c) => c.studyPeriodId !== expectedStudyPeriodId
    );
    invalidClasses.forEach((c) => {
        error.push({
            code: "INVALID_VALUE",
            path: getPathForClassId(c.id),
            message: `Class ${c.id} belongs to study period ${c.studyPeriodId}, but planning is for study period ${expectedStudyPeriodId}`
        });
    });

    return error;
}

async function validateNoDuplicateCourses(
    prisma: PrismaClient,
    classIds: Set<number>,
    getPathForClassId: (classId: number) => string[]
): Promise<ErrorFieldType[]> {
    if (classIds.size === 0) {
        return [];
    }
    const errors: ErrorFieldType[] = [];
    const classesData = await prisma.class.findMany({
        where: { id: { in: [...classIds] } },
        select: { id: true, courseId: true }
    });

    const seenCourses = new Set<number>();
    const duplicates: Array<{ courseId: number; classId: number }> = [];

    for (const classData of classesData) {
        if (seenCourses.has(classData.courseId)) {
            duplicates.push({
                courseId: classData.courseId,
                classId: classData.id
            });
        } else {
            seenCourses.add(classData.courseId);
        }
    }

    duplicates.forEach(({ courseId, classId }) => {
        errors.push({
            code: "INVALID_VALUE",
            path: getPathForClassId(classId),
            message: `Multiple classes for the same course (courseId: ${courseId}) are not allowed in a planning`
        });
    });

    return errors;
}

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const {
        path: { sid },
        body: { studyPeriodId, curriculumId, guide: inputGuide, classes, name }
    } = input;
    const guide = inputGuide ?? legacyGuide(curriculumId);
    const studyPeriod = await ctx.prisma.studyPeriod.findUnique({
        where: { id: studyPeriodId }
    });
    if (!studyPeriod) {
        const error = new ValidationError();
        error.addError({
            path: ["body", "studyPeriodId"],
            code: "REFERENCE_NOT_FOUND",
            message: `StudyPeriod with id ${studyPeriodId} not found`
        });
        return { 400: error };
    }

    const validationError = await validateClasses(
        ctx.prisma,
        classes,
        studyPeriodId,
        () => ["body", "classes"]
    );
    if (validationError) {
        return { 400: validationError };
    }
    const guideValidation = await validateGuide(ctx.prisma, guide, sid);
    if (guideValidation) return { 400: guideValidation };

    const periodPlanning = await ctx.prisma.periodPlanning.create({
        ...periodPlanningEntity.prismaSelection,
        data: {
            student: { connect: { id: sid } },
            studyPeriod: { connect: { id: studyPeriodId } },
            ...(name ? { name } : { name: `Planejamento ${studyPeriod.code}` }),
            guideMode: guide.mode,
            curriculumSource: guide.curriculumSource,
            ...(guide.curriculumId !== null
                ? { curriculum: { connect: { id: guide.curriculumId } } }
                : {}),
            ...(guide.suggestionId !== null
                ? {
                      curriculumSuggestion: {
                          connect: { id: guide.suggestionId }
                      }
                  }
                : {}),
            ...(guide.catalogProgramId !== null
                ? {
                      catalogProgram: {
                          connect: { id: guide.catalogProgramId }
                      }
                  }
                : {}),
            ...(guide.specializationId !== null
                ? {
                      specialization: {
                          connect: { id: guide.specializationId }
                      }
                  }
                : {}),
            ...(guide.languageId !== null
                ? { language: { connect: { id: guide.languageId } } }
                : {}),
            manualCourses: {
                create: guide.manualCourseIds.map((courseId) => ({
                    course: { connect: { id: courseId } }
                }))
            },
            classes: {
                connect: [...classes].map((id) => ({ id }))
            }
        }
    });
    return { 201: periodPlanningEntity.build(periodPlanning) };
};

function buildClassUpdateData(
    ops: z.infer<typeof IO.patch.input>["body"]["classes"]
) {
    if (ops.set) return { set: [...ops.set].map((id) => ({ id })) };
    return {
        disconnect: ops.remove
            ? [...ops.remove].map((id) => ({ id }))
            : undefined,
        connect: ops.add ? [...ops.add].map((id) => ({ id })) : undefined
    };
}

function guideUpdateData(guide: GuideInput) {
    return {
        guideMode: guide.mode,
        curriculumSource: guide.curriculumSource,
        curriculum:
            guide.curriculumId === null
                ? { disconnect: true }
                : { connect: { id: guide.curriculumId } },
        curriculumSuggestion:
            guide.suggestionId === null
                ? { disconnect: true }
                : { connect: { id: guide.suggestionId } },
        catalogProgram:
            guide.catalogProgramId === null
                ? { disconnect: true }
                : { connect: { id: guide.catalogProgramId } },
        specialization:
            guide.specializationId === null
                ? { disconnect: true }
                : { connect: { id: guide.specializationId } },
        language:
            guide.languageId === null
                ? { disconnect: true }
                : { connect: { id: guide.languageId } },
        manualCourses: {
            deleteMany: {},
            create: guide.manualCourseIds.map((courseId) => ({
                course: { connect: { id: courseId } }
            }))
        }
    };
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { sid, id },
        body
    } = input;
    const existing = await ctx.prisma.periodPlanning.findUnique({
        ...periodPlanningEntity.prismaSelection,
        where: {
            studentId: sid,
            id
        }
    });
    if (!existing)
        return {
            404: {
                description:
                    "PeriodPlanning not found or does not belong to the student"
            }
        };

    const guide =
        body.guide !== undefined
            ? body.guide
            : body.curriculumId !== undefined
              ? legacyGuide(body.curriculumId)
              : undefined;
    if (guide) {
        const guideValidation = await validateGuide(ctx.prisma, guide, sid);
        if (guideValidation) return { 400: guideValidation };
    }

    if (body.classes) {
        const classIdsToValidate: Set<number> = new Set(
            body.classes.set || [
                ...existing.classes.map((classEntity) => classEntity.id),
                ...(body.classes.add || [])
            ]
        );
        const validationError = await validateClasses(
            ctx.prisma,
            classIdsToValidate,
            existing.studyPeriodId,
            (_classId) => ["body", "classes", body.classes.set ? "set" : "add"]
        );

        if (validationError) {
            return { 400: validationError };
        }

        const classesUpdate = buildClassUpdateData(body.classes);
        const periodPlanning = await ctx.prisma.periodPlanning.update({
            ...periodPlanningEntity.prismaSelection,
            where: { id },
            data: {
                classes: classesUpdate,
                ...(body.name !== undefined && { name: body.name }),
                ...(guide ? guideUpdateData(guide) : {})
            }
        });
        return { 200: periodPlanningEntity.build(periodPlanning) };
    }
    if (body.name !== undefined || guide !== undefined) {
        const periodPlanning = await ctx.prisma.periodPlanning.update({
            ...periodPlanningEntity.prismaSelection,
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(guide ? guideUpdateData(guide) : {})
            }
        });
        return { 200: periodPlanningEntity.build(periodPlanning) };
    }
    return { 200: periodPlanningEntity.build(existing) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { sid, id }
    } = input;
    const existing = await ctx.prisma.periodPlanning.findUnique({
        where: {
            studentId: sid,
            id
        }
    });
    if (!existing)
        return {
            404: {
                description:
                    "PeriodPlanning not found or does not belong to the student"
            }
        };
    await ctx.prisma.periodPlanning.delete({ where: { studentId: sid, id } });
    return { 204: null };
};

router.get(
    "/student/:sid/period-plannings/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);

router.get(
    "/student/:sid/period-plannings",
    buildHandler(IO.list.input, IO.list.output, listFn)
);

router.post(
    "/student/:sid/period-plannings",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/student/:sid/period-plannings/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/student/:sid/period-plannings/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

router.get(
    "/student/:sid/period-plan/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);
router.get(
    "/student/:sid/period-plan",
    buildHandler(IO.list.input, IO.list.output, listFn)
);
router.post(
    "/student/:sid/period-plan",
    buildHandler(IO.create.input, IO.create.output, createFn)
);
router.patch(
    "/student/:sid/period-plan/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);
router.delete(
    "/student/:sid/period-plan/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(studentId: number, periodPlanningId: number) {
    return `/student/${studentId}/period-plannings/${periodPlanningId}`;
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
        entity: entityPath
    }
};
