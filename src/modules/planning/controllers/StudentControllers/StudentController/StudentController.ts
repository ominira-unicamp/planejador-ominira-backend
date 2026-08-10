import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import {
    AuthRegistry,
    AuthRoles,
    ForbiddenError,
    raFromDacEmail
} from "#/auth.js";
import {
    buildHandler,
    openApiArgsFromIO,
    type Context,
    type HandlerFn
} from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/planning/contracts/students/StudentInterface.js";
import studentEntity from "#/modules/planning/controllers/StudentControllers/StudentController/Entity.js";
import { ValidationError } from "#/Validation.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

async function validateProgramSpecialization(
    prisma: Context["prisma"],
    programId: number | null | undefined,
    specializationId: number | null | undefined
) {
    if (specializationId == null) return null;

    if (programId == null)
        return new ValidationError([
            {
                code: "REQUIRED",
                path: ["body", "programId"],
                message:
                    "programId is required when specializationId is provided"
            }
        ]);

    const specialization = await prisma.specialization.findUnique({
        where: { id: specializationId },
        select: { programId: true }
    });
    if (!specialization)
        return new ValidationError([
            {
                code: "REFERENCE_NOT_FOUND",
                path: ["body", "specializationId"],
                message: `Specialization with id ${specializationId} not found`
            }
        ]);

    if (specialization.programId !== programId)
        return new ValidationError([
            {
                code: "INVALID_VALUE",
                path: ["body", "specializationId"],
                message: `Specialization ${specializationId} does not belong to program ${programId}`
            }
        ]);

    return null;
}

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const students = await ctx.prisma.student.findMany();
    const entities = students.map(studentEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.student,
    {},
    studentEntity.build,
    "Student not found"
);

export const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;
    const principal = ctx.principal;
    if (!principal) throw new ForbiddenError();
    const ra = raFromDacEmail(principal.email);
    if (!ra) throw new ForbiddenError();

    const existing = await ctx.prisma.student.findUnique({
        where: { ra }
    });
    if (existing?.authUserId === principal.authUserId) {
        return { 409: { description: "This identity already has a student" } };
    }
    if (existing?.authUserId != null) {
        return {
            409: { description: "The RA is already linked to another identity" }
        };
    }
    if (existing) {
        const student = await ctx.prisma.student.update({
            where: { id: existing.id },
            data: { authUserId: principal.authUserId }
        });
        return { 200: studentEntity.build(student) };
    }
    const validation = await validateProgramSpecialization(
        ctx.prisma,
        body.programId,
        body.specializationId
    );
    if (validation) return { 400: validation };

    const student = await ctx.prisma.student.create({
        data: {
            ra,
            name: body.name,
            programId: body.programId,
            specializationId: body.specializationId,
            catalogId: body.catalogId
        }
    });
    return { 201: studentEntity.build(student) };
};

export const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;
    const existing = await ctx.prisma.student.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Student not found" } };

    const validation = await validateProgramSpecialization(
        ctx.prisma,
        body.programId !== undefined ? body.programId : existing.programId,
        body.specializationId !== undefined
            ? body.specializationId
            : existing.specializationId
    );
    if (validation) return { 400: validation };

    const student = await ctx.prisma.student.update({
        where: { id },
        data: {
            ...(body.ra !== undefined && { ra: body.ra }),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.programId !== undefined && { programId: body.programId }),
            ...(body.specializationId !== undefined && {
                specializationId: body.specializationId
            }),
            ...(body.catalogId !== undefined && { catalogId: body.catalogId })
        }
    });
    return { 200: studentEntity.build(student) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id },
        body: { confirmationRa }
    } = input;
    const principal = ctx.principal;
    if (!principal) throw new ForbiddenError();
    if (principal.studentId !== id && !principal.roles.has(AuthRoles.ADMIN)) {
        throw new ForbiddenError();
    }

    const existing = await ctx.prisma.student.findUnique({
        where: { id },
        select: { id: true, ra: true, authUserId: true }
    });
    if (!existing) return { 404: { description: "Student not found" } };
    if (existing.ra !== confirmationRa) {
        return {
            400: new ValidationError([
                {
                    code: "INVALID_VALUE",
                    path: ["body", "confirmationRa"],
                    message: "The confirmation RA does not match the student"
                }
            ])
        };
    }

    await ctx.prisma.$transaction(async (tx) => {
        await tx.studentCourse.deleteMany({ where: { studentId: id } });
        await tx.curriculumCourse.deleteMany({
            where: { curriculum: { studentId: id } }
        });
        await tx.curriculum.deleteMany({ where: { studentId: id } });
        await tx.periodPlanning.deleteMany({ where: { studentId: id } });
        await tx.student.delete({ where: { id } });
        if (existing.authUserId != null) {
            await tx.authUser.delete({ where: { id: existing.authUserId } });
        }
    });
    return { 204: null };
};

router.get("/students/:id", get);

router.get("/students", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/students",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/students/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/students/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(studentId: number) {
    return `/students/${studentId}`;
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
