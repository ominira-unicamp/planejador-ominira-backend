import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO from "#/modules/planning/contracts/students/StudentCourseInterface.js";
import attemptEntity from "#/modules/planning/controllers/StudentControllers/StudentCourseController/Entity.js";
import { ValidationError } from "@pomi/api-core";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

function validationError(path: string[], message: string) {
    return new ValidationError([
        { code: "REFERENCE_NOT_FOUND", path, message }
    ]);
}

function invalidValueError(path: string[], message: string) {
    return new ValidationError([{ code: "INVALID_VALUE", path, message }]);
}

async function validateReferences(
    ctx: Parameters<HandlerFn<typeof IO.create>>[0],
    courseId: number,
    studyPeriodId: number | null | undefined,
    classId: number | null | undefined
) {
    const course = await ctx.prisma.course.findUnique({
        where: { id: courseId }
    });
    if (!course)
        return validationError(
            ["body", "courseId"],
            `Course with id ${courseId} not found`
        );
    if (studyPeriodId !== null && studyPeriodId !== undefined) {
        const period = await ctx.prisma.studyPeriod.findUnique({
            where: { id: studyPeriodId }
        });
        if (!period)
            return validationError(
                ["body", "studyPeriodId"],
                `StudyPeriod with id ${studyPeriodId} not found`
            );
    }
    if (classId === null || classId === undefined) return null;
    if (studyPeriodId === null || studyPeriodId === undefined)
        return invalidValueError(
            ["body", "classId"],
            "A class requires a study period"
        );
    const classData = await ctx.prisma.class.findUnique({
        where: { id: classId },
        select: { courseId: true, studyPeriodId: true }
    });
    if (!classData)
        return validationError(
            ["body", "classId"],
            `Class with id ${classId} not found`
        );
    if (classData.courseId !== courseId)
        return invalidValueError(
            ["body", "classId"],
            "The class must belong to the selected course"
        );
    if (classData.studyPeriodId !== studyPeriodId)
        return invalidValueError(
            ["body", "classId"],
            "The class must belong to the selected study period"
        );
    return null;
}

async function validateActiveAttempt(
    ctx: Parameters<HandlerFn<typeof IO.create>>[0],
    studentId: number,
    courseId: number,
    status: "ENROLLED" | "COMPLETED" | "FAILED" | "DROPPED",
    excludedId?: number
) {
    if (status !== "ENROLLED") return null;
    const existing = await ctx.prisma.studentCourseAttempt.findFirst({
        where: {
            studentId,
            courseId,
            status: "ENROLLED",
            ...(excludedId === undefined ? {} : { id: { not: excludedId } })
        },
        select: { id: true }
    });
    if (!existing) return null;
    return new ValidationError([
        {
            code: "ALREADY_EXISTS",
            path: ["body", "status"],
            message: "Student already has an active attempt for this course"
        }
    ]);
}

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { sid } = input.path;
    const { status, courseId, studyPeriodId } = input.query ?? {};
    const attempts = await ctx.prisma.studentCourseAttempt.findMany({
        ...attemptEntity.prismaSelection,
        where: {
            studentId: sid,
            ...(status ? { status } : {}),
            ...(courseId ? { courseId } : {}),
            ...(studyPeriodId ? { studyPeriodId } : {})
        },
        orderBy: [{ studyPeriod: { startDate: "desc" } }, { createdAt: "desc" }]
    });
    return { 200: attempts.map(attemptEntity.build) };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const attempt = await ctx.prisma.studentCourseAttempt.findFirst({
        ...attemptEntity.prismaSelection,
        where: { id: input.path.id, studentId: input.path.sid }
    });
    if (!attempt)
        return { 404: { description: "Student course attempt not found" } };
    return { 200: attemptEntity.build(attempt) };
};

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { sid } = input.path;
    const { courseId, studyPeriodId, classId, status, grade } = input.body;
    const referenceError = await validateReferences(
        ctx,
        courseId,
        studyPeriodId,
        classId
    );
    if (referenceError) return { 400: referenceError };
    const activeError = await validateActiveAttempt(ctx, sid, courseId, status);
    if (activeError) return { 400: activeError };
    const attempt = await ctx.prisma.studentCourseAttempt.create({
        ...attemptEntity.prismaSelection,
        data: {
            studentId: sid,
            courseId,
            studyPeriodId,
            classId,
            status,
            grade
        }
    });
    return { 201: attemptEntity.build(attempt) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const existing = await ctx.prisma.studentCourseAttempt.findFirst({
        where: { id: input.path.id, studentId: input.path.sid }
    });
    if (!existing)
        return { 404: { description: "Student course attempt not found" } };
    const next = { ...existing, ...input.body };
    const referenceError = await validateReferences(
        ctx,
        next.courseId,
        next.studyPeriodId,
        next.classId
    );
    if (referenceError) return { 400: referenceError };
    const activeError = await validateActiveAttempt(
        ctx,
        existing.studentId,
        existing.courseId,
        next.status,
        existing.id
    );
    if (activeError) return { 400: activeError };
    const attempt = await ctx.prisma.studentCourseAttempt.update({
        ...attemptEntity.prismaSelection,
        where: { id: existing.id },
        data: input.body
    });
    return { 200: attemptEntity.build(attempt) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const existing = await ctx.prisma.studentCourseAttempt.findFirst({
        where: { id: input.path.id, studentId: input.path.sid },
        select: { id: true }
    });
    if (!existing)
        return { 404: { description: "Student course attempt not found" } };
    await ctx.prisma.studentCourseAttempt.delete({
        where: { id: existing.id }
    });
    return { 204: null };
};

router.get(
    "/student/:sid/course-attempts",
    buildHandler(IO.list.input, IO.list.output, listFn)
);
router.get(
    "/student/:sid/course-attempts/:id",
    buildHandler(IO.get.input, IO.get.output, getFn)
);
router.post(
    "/student/:sid/course-attempts",
    buildHandler(IO.create.input, IO.create.output, createFn)
);
router.patch(
    "/student/:sid/course-attempts/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);
router.delete(
    "/student/:sid/course-attempts/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

const registry = new OpenAPIRegistry();
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    router,
    registry,
    authRegistry,
    paths: {
        entity: (studentId: number, id: number) =>
            `/student/${studentId}/course-attempts/${id}`
    }
};
