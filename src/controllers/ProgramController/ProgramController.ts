import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "../../auth.js";
import {
    buildHandler,
    HandlerFn,
    openApiArgsFromIO
} from "../../BuildHandler.js";
import { defaultGetHandler } from "../../defaultEndpoint.js";
import IO from "../../Interfaces/ProgramInterface.js";
import { ValidationError } from "../../Validation.js";
import programEntity from "./Entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/programs/:id");
authRegistry.addException("GET", "/programs");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { query } = input;
    const programs = await ctx.prisma.program.findMany({
        ...programEntity.prismaSelection,
        where: {
            ...(query?.unitId && { unitId: query.unitId })
        },
        orderBy: {
            name: "asc"
        }
    });
    const entities = programs.map(programEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.program,
    programEntity.prismaSelection,
    programEntity.build,
    "Program not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const {
        body: { code, name, unitId }
    } = input;

    const unit = await ctx.prisma.unit.findUnique({
        where: { id: unitId }
    });
    if (!unit) {
        const error = new ValidationError();
        error.addError({
            path: ["body", "unitId"],
            code: "REFERENCE_NOT_FOUND",
            message: `Unit with id ${unitId} not found`
        });
        return { 400: error };
    }

    const existing = await ctx.prisma.program.findUnique({
        where: { code }
    });

    if (existing) {
        const error = new ValidationError();
        error.addError({
            path: ["body", "code"],
            code: "ALREADY_EXISTS",
            message: `Program with code ${code} already exists`
        });
        return { 400: error };
    }

    const program = await ctx.prisma.program.create({
        ...programEntity.prismaSelection,
        data: {
            code,
            name,
            unitId
        }
    });
    return { 201: programEntity.build(program) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;

    const existing = await ctx.prisma.program.findUnique({
        where: { id }
    });

    if (!existing) {
        return { 404: { description: "Program not found" } };
    }

    if (body.unitId) {
        const unit = await ctx.prisma.unit.findUnique({
            where: { id: body.unitId }
        });
        if (!unit) {
            const error = new ValidationError();
            error.addError({
                path: ["body", "unitId"],
                code: "REFERENCE_NOT_FOUND",
                message: `Unit with id ${body.unitId} not found`
            });
            return { 400: error };
        }
    }

    if (body.code) {
        const duplicate = await ctx.prisma.program.findUnique({
            where: { code: body.code }
        });

        if (duplicate && duplicate.id !== id) {
            const error = new ValidationError();
            error.addError({
                path: ["body", "code"],
                code: "ALREADY_EXISTS",
                message: `Program with code ${body.code} already exists`
            });
            return { 400: error };
        }
    }

    const program = await ctx.prisma.program.update({
        ...programEntity.prismaSelection,
        where: { id },
        data: body
    });

    return { 200: programEntity.build(program) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.program.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    catalogPrograms: true,
                    students: true
                }
            }
        }
    });

    if (!existing) {
        return { 404: { description: "Program not found" } };
    }

    if (existing._count.catalogPrograms > 0 || existing._count.students > 0) {
        const error = new ValidationError();
        error.addError({
            path: ["path", "id"],
            code: "REFERENCE_EXISTS",
            message: `Cannot delete program with ${existing._count.students} students and ${existing._count.catalogPrograms} catalog programs`
        });
        return { 400: error };
    }

    await ctx.prisma.program.delete({ where: { id } });
    return { 204: null };
};

router.get("/programs/:id", get);

router.get("/programs", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/programs",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/programs/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/programs/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(programId: number) {
    return `/programs/${programId}`;
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
