import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/schedule/calendar-tag/CalendarTag.contract.js";
import calendarTagEntity from "#/modules/schedule/calendar-tag/CalendarTag.entity.js";

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

router.get("/calendar-tags/:id", get);
router.get(
    "/calendar-tags",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(id: number) {
    return `/calendar-tags/${id}`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath
    }
};
