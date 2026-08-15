import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/schedule/calendar-event/CalendarEvent.contract.js";
import calendarEventEntity from "#/modules/schedule/calendar-event/CalendarEvent.entity.js";
import { ValidationError } from "@pomi/api-core";
import { MyPrisma } from "@pomi/db";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/calendar-events");
authRegistry.addException("GET", "/calendar-events/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { startDate, endDate, tagId } = input.query;
    if (startDate && endDate && startDate > endDate) {
        return {
            400: new ValidationError([
                {
                    code: "INVALID_VALUE",
                    path: ["query", "startDate"],
                    message: "startDate must be before or equal to endDate"
                }
            ])
        };
    }

    const where: MyPrisma.CalendarEventWhereInput = {
        ...(endDate ? { startDate: { lte: endDate } } : {}),
        ...(startDate
            ? {
                  OR: [{ endDate: { gte: startDate } }, { endDate: null }]
              }
            : {}),
        ...(tagId !== undefined
            ? {
                  tags: {
                      some: {
                          id: { in: tagId }
                      }
                  }
              }
            : {})
    };

    const calendarEvents = await ctx.prisma.calendarEvent.findMany({
        ...calendarEventEntity.prismaSelection,
        where,
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }]
    });

    return { 200: calendarEvents.map(calendarEventEntity.build) };
};

const get = defaultGetHandler(
    (p) => p.calendarEvent,
    calendarEventEntity.prismaSelection,
    calendarEventEntity.build,
    "Calendar event not found"
);

router.get("/calendar-events/:id", get);
router.get(
    "/calendar-events",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(id: number) {
    return `/calendar-events/${id}`;
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
