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
import { ErrorFieldType, ValidationError } from "#/Validation.js";
import { PrismaClient } from "../../../../../../prisma/generated/client.js";

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

async function validateCurriculum(
    prisma: PrismaClient,
    curriculumId: number | null | undefined,
    studentId: number
): Promise<ValidationError | null> {
    if (curriculumId === undefined || curriculumId === null) return null;
    const curriculum = await prisma.curriculum.findFirst({
        where: { id: curriculumId, studentId },
        select: { id: true }
    });
    if (curriculum) return null;
    const error = new ValidationError();
    error.addError({
        path: ["body", "curriculumId"],
        code: "REFERENCE_NOT_FOUND",
        message: `Curriculum ${curriculumId} not found for student ${studentId}`
    });
    return error;
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
        body: { studyPeriodId, curriculumId, classes, name }
    } = input;
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
    const curriculumValidation = await validateCurriculum(
        ctx.prisma,
        curriculumId,
        sid
    );
    if (curriculumValidation) return { 400: curriculumValidation };

    const periodPlanning = await ctx.prisma.periodPlanning.create({
        ...periodPlanningEntity.prismaSelection,
        data: {
            studentId: sid,
            studyPeriodId,
            ...(name ? { name } : { name: `Planejamento ${studyPeriod.code}` }),
            ...(curriculumId === undefined
                ? {}
                : curriculumId === null
                  ? {}
                  : { curriculum: { connect: { id: curriculumId } } }),
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

    const curriculumValidation = await validateCurriculum(
        ctx.prisma,
        body.curriculumId,
        sid
    );
    if (curriculumValidation) return { 400: curriculumValidation };

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
                ...(body.curriculumId !== undefined &&
                    (body.curriculumId === null
                        ? { curriculum: { disconnect: true } }
                        : {
                              curriculum: { connect: { id: body.curriculumId } }
                          }))
            }
        });
        return { 200: periodPlanningEntity.build(periodPlanning) };
    }
    if (body.name !== undefined || body.curriculumId !== undefined) {
        const periodPlanning = await ctx.prisma.periodPlanning.update({
            ...periodPlanningEntity.prismaSelection,
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.curriculumId !== undefined &&
                    (body.curriculumId === null
                        ? { curriculum: { disconnect: true } }
                        : {
                              curriculum: { connect: { id: body.curriculumId } }
                          }))
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
