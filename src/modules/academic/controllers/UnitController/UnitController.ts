import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/academic/contracts/UnitInterface.js";
import unitEntity from "#/modules/academic/controllers/UnitController/Entity.js";
import { ValidationError } from "#/Validation.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/units");
authRegistry.addException("GET", "/units/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const units = await ctx.prisma.unit.findMany();
    const entities = units.map(unitEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.unit,
    {},
    unitEntity.build,
    "Unit not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;
    const existing = await ctx.prisma.unit.findUnique({
        where: { code: body.code }
    });
    if (existing) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "code"],
                    message: "An unit with this code already exists"
                }
            ])
        };
    }
    const unit = await ctx.prisma.unit.create({
        data: {
            code: body.code
        }
    });
    return { 201: unitEntity.build(unit) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;
    const existing = await ctx.prisma.unit.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Unit not found" } };

    if (body.code !== undefined) {
        const codeExists = await ctx.prisma.unit.findUnique({
            where: { code: body.code }
        });
        if (codeExists && codeExists.id !== id) {
            return {
                400: new ValidationError([
                    {
                        code: "ALREADY_EXISTS",
                        path: ["body", "code"],
                        message: "An unit with this code already exists"
                    }
                ])
            };
        }
    }

    const unit = await ctx.prisma.unit.update({
        where: { id },
        data: {
            ...(body.code !== undefined && { code: body.code })
        }
    });
    return { 200: unitEntity.build(unit) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;
    const existing = await ctx.prisma.unit.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Unit not found" } };
    await ctx.prisma.unit.delete({ where: { id } });
    return { 204: null };
};

router.get("/units/:id", get);

router.get("/units", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/units",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/units/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/units/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(unitId: number) {
    return `/units/${unitId}`;
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
