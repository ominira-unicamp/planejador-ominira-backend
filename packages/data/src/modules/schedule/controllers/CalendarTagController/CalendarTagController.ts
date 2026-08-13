import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/schedule/contracts/CalendarTagInterface.js";
import calendarTagEntity from "#/modules/schedule/controllers/CalendarTagController/Entity.js";
import { ValidationError } from "@pomi/api-core";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/calendar-tags");
authRegistry.addException("GET", "/calendar-tags/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const calendarTags = await ctx.prisma.calendarTag.findMany({
        orderBy: {
            name: "asc"
        }
    });
    return { 200: calendarTags.map(calendarTagEntity.build) };
};

const get = defaultGetHandler(
    (p) => p.calendarTag,
    {},
    calendarTagEntity.build,
    "Calendar tag not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { name } = input.body;
    const existing = await ctx.prisma.calendarTag.findUnique({
        where: { name }
    });

    if (existing) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "name"],
                    message: "A calendar tag with this name already exists"
                }
            ])
        };
    }

    const calendarTag = await ctx.prisma.calendarTag.create({
        data: { name }
    });
    return { 201: calendarTagEntity.build(calendarTag) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body: { name }
    } = input;

    const existing = await ctx.prisma.calendarTag.findUnique({
        where: { id }
    });
    if (!existing) {
        return { 404: { description: "Calendar tag not found" } };
    }

    const duplicate = await ctx.prisma.calendarTag.findUnique({
        where: { name }
    });
    if (duplicate && duplicate.id !== id) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "name"],
                    message: "A calendar tag with this name already exists"
                }
            ])
        };
    }

    const calendarTag = await ctx.prisma.calendarTag.update({
        where: { id },
        data: { name }
    });
    return { 200: calendarTagEntity.build(calendarTag) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.calendarTag.findUnique({
        where: { id }
    });
    if (!existing) {
        return { 404: { description: "Calendar tag not found" } };
    }

    await ctx.prisma.calendarTag.delete({ where: { id } });
    return { 204: null };
};

router.get("/calendar-tags/:id", get);
router.get(
    "/calendar-tags",
    buildHandler(IO.list.request, IO.list.response, listFn)
);
router.post(
    "/calendar-tags",
    buildHandler(IO.create.request, IO.create.response, createFn)
);
router.patch(
    "/calendar-tags/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);
router.delete(
    "/calendar-tags/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function entityPath(id: number) {
    return `/calendar-tags/${id}`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath
    }
};
