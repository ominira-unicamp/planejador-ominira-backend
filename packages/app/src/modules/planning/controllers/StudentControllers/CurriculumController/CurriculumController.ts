import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO from "#/modules/planning/contracts/students/CurriculumInterface.js";
import curriculumEntity from "#/modules/planning/controllers/StudentControllers/CurriculumController/Entity.js";
import { ValidationError } from "@pomi/api-core";
import { PrismaClient } from "@pomi/db";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/curricula/:id");

type TxType = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
type CurriculumBody = z.infer<typeof IO.create.input>["body"];
type PatchBody = z.infer<typeof IO.patch.input>["body"];

function selectionData(selection: CurriculumBody["selection"] | undefined) {
    return {
        catalogProgramId: selection?.catalogProgramId ?? null,
        catalogSpecializationId: selection?.catalogSpecializationId ?? null,
        catalogLanguageId: selection?.catalogLanguageId ?? null
    };
}

function planningStartData(
    planningStart: CurriculumBody["planningStart"] | undefined
) {
    return planningStart
        ? {
              planningStartYear: planningStart.year,
              planningStartSemester: planningStart.semester,
              planningStartNumber: planningStart.semesterNumber
          }
        : {
              planningStartYear: null,
              planningStartSemester: null,
              planningStartNumber: null
          };
}

async function validateSelection(
    tx: TxType,
    selection: {
        catalogProgramId: number | null;
        catalogSpecializationId: number | null;
        catalogLanguageId: number | null;
    }
) {
    const error = new ValidationError();
    if (selection.catalogProgramId !== null) {
        const catalogProgram = await tx.catalogProgram.findUnique({
            where: { id: selection.catalogProgramId }
        });
        if (!catalogProgram) {
            error.addError({
                path: ["body", "selection", "catalogProgramId"],
                code: "REFERENCE_NOT_FOUND",
                message: `CatalogProgram ${selection.catalogProgramId} not found`
            });
        }
    }
    if (selection.catalogSpecializationId !== null) {
        const specialization = await tx.catalogSpecialization.findUnique({
            where: { id: selection.catalogSpecializationId }
        });
        if (
            !specialization ||
            specialization.catalogProgramId !== selection.catalogProgramId
        ) {
            error.addError({
                path: ["body", "selection", "catalogSpecializationId"],
                code: "INVALID_VALUE",
                message:
                    "Catalog specialization is incompatible with the catalog program"
            });
        }
    }
    if (selection.catalogLanguageId !== null) {
        const language = await tx.catalogLanguage.findUnique({
            where: { id: selection.catalogLanguageId }
        });
        if (
            !language ||
            language.catalogProgramId !== selection.catalogProgramId
        ) {
            error.addError({
                path: ["body", "selection", "catalogLanguageId"],
                code: "INVALID_VALUE",
                message:
                    "Catalog language is incompatible with the catalog program"
            });
        }
    }
    return error.errors.length > 0 ? error : null;
}

async function validateCourseIds(
    tx: TxType,
    courseIds: number[],
    path: string[]
) {
    const uniqueIds = [...new Set(courseIds)];
    const found = await tx.course.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true }
    });
    const error = new ValidationError();
    for (const id of uniqueIds) {
        if (!found.some((course) => course.id === id)) {
            error.addError({
                path: [...path, String(id)],
                code: "REFERENCE_NOT_FOUND",
                message: `Course ${id} not found`
            });
        }
    }
    return error.errors.length > 0 ? error : null;
}

async function loadCurriculum(
    ctx: { prisma: PrismaClient },
    sid: number,
    id: number
) {
    return ctx.prisma.curriculum.findUnique({
        ...curriculumEntity.prismaSelection,
        where: { studentId: sid, id }
    });
}

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const curricula = await ctx.prisma.curriculum.findMany({
        ...curriculumEntity.prismaSummarySelection,
        where: { studentId: input.path.sid },
        orderBy: { updatedAt: "desc" }
    });
    return {
        200: curricula
            .map(curriculumEntity.buildSummary)
            .sort(
                (left, right) =>
                    Number(right.isFavorite) - Number(left.isFavorite)
            )
    };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const curriculum = await loadCurriculum(ctx, input.path.sid, input.path.id);
    if (!curriculum)
        return {
            404: {
                description:
                    "Curriculum not found or does not belong to the student"
            }
        };
    return { 200: curriculumEntity.build(curriculum) };
};

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { sid } = input.path;
    const body = input.body;
    const selection = selectionData(body.selection);
    const selectionError = await validateSelection(ctx.prisma, selection);
    if (selectionError) return { 400: selectionError };

    const courses = body.courses ?? [];
    const courseError = await validateCourseIds(
        ctx.prisma,
        courses.map((course) => course.courseId),
        ["body", "courses"]
    );
    if (courseError) return { 400: courseError };

    const curriculum = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.curriculum.create({
            data: {
                studentId: sid,
                name: body.name ?? "Novo planejamento",
                ...selection,
                ...planningStartData(body.planningStart),
                currentPeriodId: body.currentPeriodId ?? null,
                periods: body.periods ? { create: body.periods } : undefined,
                courses: courses.length
                    ? {
                          create: courses.map((course) => ({
                              courseId: course.courseId,
                              periodId: course.periodId
                          }))
                      }
                    : undefined
            },
            select: { id: true }
        });
        return tx.curriculum.findUniqueOrThrow({
            ...curriculumEntity.prismaSelection,
            where: { id: created.id }
        });
    });
    return { 201: curriculumEntity.build(curriculum) };
};

async function patchPeriods(
    tx: TxType,
    curriculumId: number,
    operations: NonNullable<PatchBody["periods"]>
) {
    const existing = await tx.curriculumPeriod.findMany({
        where: { curriculumId },
        select: { id: true, position: true }
    });
    const existingIds = new Set(existing.map((period) => period.id));
    const error = new ValidationError();
    for (const update of operations.update ?? []) {
        if (!existingIds.has(update.id))
            error.addError({
                path: ["body", "periods", "update", String(update.id)],
                code: "REFERENCE_NOT_FOUND",
                message: `Period ${update.id} not found in curriculum ${curriculumId}`
            });
    }
    for (const id of operations.remove ?? []) {
        if (!existingIds.has(id))
            error.addError({
                path: ["body", "periods", "remove", String(id)],
                code: "REFERENCE_NOT_FOUND",
                message: `Period ${id} not found in curriculum ${curriculumId}`
            });
    }
    if (error.errors.length > 0) return error;

    const removedIds = new Set(operations.remove ?? []);
    const finalPositions = new Map<number, number>();
    for (const period of existing) {
        if (!removedIds.has(period.id))
            finalPositions.set(period.id, period.position);
    }
    for (const update of operations.update ?? [])
        finalPositions.set(update.id, update.position);
    for (const add of operations.add ?? [])
        finalPositions.set(-finalPositions.size - 1, add.position);
    const positions = [...finalPositions.values()];
    if (new Set(positions).size !== positions.length) {
        error.addError({
            path: ["body", "periods"],
            code: "INVALID_VALUE",
            message: "Period positions must be unique within a curriculum"
        });
        return error;
    }

    await tx.curriculumCourse.updateMany({
        where: { curriculumId, periodId: { in: [...removedIds] } },
        data: { periodId: null }
    });
    if (removedIds.size > 0)
        await tx.curriculumPeriod.deleteMany({
            where: { curriculumId, id: { in: [...removedIds] } }
        });
    for (const update of operations.update ?? [])
        await tx.curriculumPeriod.update({
            where: { id: update.id },
            data: { position: -update.id }
        });
    for (const update of operations.update ?? [])
        await tx.curriculumPeriod.update({
            where: { id: update.id },
            data: { position: update.position }
        });
    const additions = operations.add ?? [];
    if (additions.length > 0)
        await tx.curriculumPeriod.createMany({
            data: additions.map((period) => ({
                curriculumId,
                position: period.position
            }))
        });
    return null;
}

async function patchCourses(
    tx: TxType,
    curriculumId: number,
    operations: NonNullable<PatchBody["courses"]>
) {
    const upserts = operations.upsert ?? [];
    const courseError = await validateCourseIds(
        tx,
        upserts.map((course) => course.courseId),
        ["body", "courses", "upsert"]
    );
    if (courseError) return courseError;
    const periodIds = upserts
        .map((course) => course.periodId)
        .filter((id): id is number => id !== null);
    if (periodIds.length > 0) {
        const periods = await tx.curriculumPeriod.findMany({
            where: { curriculumId, id: { in: periodIds } },
            select: { id: true }
        });
        if (periods.length !== new Set(periodIds).size) {
            const error = new ValidationError();
            error.addError({
                path: ["body", "courses", "upsert"],
                code: "REFERENCE_NOT_FOUND",
                message: "Every period must belong to the curriculum"
            });
            return error;
        }
    }
    if (operations.remove)
        await tx.curriculumCourse.deleteMany({
            where: { curriculumId, courseId: { in: operations.remove } }
        });
    for (const course of upserts)
        await tx.curriculumCourse.upsert({
            where: {
                curriculumId_courseId: {
                    curriculumId,
                    courseId: course.courseId
                }
            },
            create: {
                curriculumId,
                courseId: course.courseId,
                periodId: course.periodId
            },
            update: { periodId: course.periodId }
        });
    return null;
}

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const { sid, id } = input.path;
    const existing = await ctx.prisma.curriculum.findUnique({
        where: { studentId: sid, id },
        select: {
            catalogProgramId: true,
            catalogSpecializationId: true,
            catalogLanguageId: true
        }
    });
    if (!existing)
        return {
            404: {
                description:
                    "Curriculum not found or does not belong to the student"
            }
        };

    const selection = {
        catalogProgramId:
            input.body.selection?.catalogProgramId !== undefined
                ? input.body.selection.catalogProgramId
                : existing.catalogProgramId,
        catalogSpecializationId:
            input.body.selection?.catalogSpecializationId !== undefined
                ? input.body.selection.catalogSpecializationId
                : existing.catalogSpecializationId,
        catalogLanguageId:
            input.body.selection?.catalogLanguageId !== undefined
                ? input.body.selection.catalogLanguageId
                : existing.catalogLanguageId
    };
    const selectionError = await validateSelection(ctx.prisma, selection);
    if (selectionError) return { 400: selectionError };

    const operationError = await ctx.prisma.$transaction(async (tx) => {
        if (input.body.periods) {
            const error = await patchPeriods(tx, id, input.body.periods);
            if (error) return error;
        }
        if (input.body.courses) {
            const error = await patchCourses(tx, id, input.body.courses);
            if (error) return error;
        }
        if (
            input.body.currentPeriodId !== undefined &&
            input.body.currentPeriodId !== null
        ) {
            const period = await tx.curriculumPeriod.findFirst({
                where: { id: input.body.currentPeriodId, curriculumId: id },
                select: { id: true }
            });
            if (!period) {
                const error = new ValidationError();
                error.addError({
                    path: ["body", "currentPeriodId"],
                    code: "REFERENCE_NOT_FOUND",
                    message: "Current period must belong to the curriculum"
                });
                return error;
            }
        }
        await tx.curriculum.update({
            where: { id },
            data: {
                ...(input.body.name !== undefined && { name: input.body.name }),
                ...(input.body.selection && selection),
                ...(input.body.planningStart !== undefined &&
                    planningStartData(input.body.planningStart)),
                ...(input.body.currentPeriodId !== undefined && {
                    currentPeriodId: input.body.currentPeriodId
                })
            }
        });
        if (input.body.isFavorite !== undefined) {
            const student = await tx.student.findUnique({
                where: { id: sid },
                select: { favoriteCurriculumId: true }
            });
            if (student) {
                await tx.student.update({
                    where: { id: sid },
                    data: {
                        favoriteCurriculumId: input.body.isFavorite
                            ? id
                            : student.favoriteCurriculumId === id
                              ? null
                              : student.favoriteCurriculumId
                    }
                });
            }
        }
        return null;
    });
    if (operationError) return { 400: operationError };
    const curriculum = await loadCurriculum(ctx, sid, id);
    if (!curriculum) return { 404: { description: "Curriculum not found" } };
    return { 200: curriculumEntity.build(curriculum) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const existing = await ctx.prisma.curriculum.findUnique({
        where: { studentId: input.path.sid, id: input.path.id }
    });
    if (!existing)
        return {
            404: {
                description:
                    "Curriculum not found or does not belong to the student"
            }
        };
    await ctx.prisma.curriculum.delete({ where: { id: existing.id } });
    return { 204: null };
};

router.get(
    "/student/:sid/curricula/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);
router.get(
    "/student/:sid/curricula",
    buildHandler(IO.list.input, IO.list.output, listFn)
);
router.post(
    "/student/:sid/curricula",
    buildHandler(IO.create.input, IO.create.output, createFn)
);
router.patch(
    "/student/:sid/curricula/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);
router.delete(
    "/student/:sid/curricula/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(studentId: number, curriculumId: number) {
    return `/student/${studentId}/curricula/${curriculumId}`;
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
    paths: { entity: entityPath }
};
