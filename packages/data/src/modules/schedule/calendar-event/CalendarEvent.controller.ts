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
import { ValidationError, ZodToApiError } from "@pomi/api-core";
import { MyPrisma } from "@pomi/db";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/calendar-events");
authRegistry.addException("GET", "/calendar-events/:id");

function invalidDateRange() {
    return new ValidationError([
        {
            code: "INVALID_VALUE",
            path: ["body", "startDate"],
            message: "startDate must be before or equal to endDate"
        }
    ]);
}

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

const validateTagIds = async (
    ctx: Parameters<HandlerFn<typeof IO.create>>[0],
    tagIds: number[]
) => {
    const validation = await z
        .object({
            tagIds: ctx.zodIds.calendarTag.existsMany
        })
        .safeParseAsync({ tagIds });

    if (!validation.success) {
        return new ValidationError(ZodToApiError(validation.error, ["body"]));
    }
};

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { startDate, endDate, description, tagIds } = input.body;
    const tagValidation = await validateTagIds(ctx, tagIds);
    if (tagValidation) return { 400: tagValidation };

    const calendarEvent = await ctx.prisma.calendarEvent.create({
        ...calendarEventEntity.prismaSelection,
        data: {
            startDate,
            endDate,
            description,
            tags: {
                connect: tagIds.map((id) => ({ id }))
            }
        }
    });

    return { 201: calendarEventEntity.build(calendarEvent) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;

    const existing = await ctx.prisma.calendarEvent.findUnique({
        where: { id }
    });
    if (!existing) {
        return { 404: { description: "Calendar event not found" } };
    }

    const nextStartDate = body.startDate ?? existing.startDate;
    const nextEndDate = body.endDate ?? existing.endDate;
    if (nextEndDate && nextStartDate > nextEndDate) {
        return { 400: invalidDateRange() };
    }

    if (body.tagIds !== undefined) {
        const tagValidation = await validateTagIds(ctx, body.tagIds);
        if (tagValidation) return { 400: tagValidation };
    }

    const calendarEvent = await ctx.prisma.calendarEvent.update({
        ...calendarEventEntity.prismaSelection,
        where: { id },
        data: {
            ...(body.startDate !== undefined && {
                startDate: body.startDate
            }),
            ...(body.endDate !== undefined && { endDate: body.endDate }),
            ...(body.description !== undefined && {
                description: body.description
            }),
            ...(body.tagIds !== undefined && {
                tags: {
                    set: body.tagIds.map((tagId) => ({ id: tagId }))
                }
            })
        }
    });

    return { 200: calendarEventEntity.build(calendarEvent) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.calendarEvent.findUnique({
        where: { id }
    });
    if (!existing) {
        return { 404: { description: "Calendar event not found" } };
    }

    await ctx.prisma.calendarEvent.delete({ where: { id } });
    return { 204: null };
};

router.get("/calendar-events/:id", get);
router.get(
    "/calendar-events",
    buildHandler(IO.list.request, IO.list.response, listFn)
);
router.post(
    "/calendar-events",
    buildHandler(IO.create.request, IO.create.response, createFn)
);
router.patch(
    "/calendar-events/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);
router.delete(
    "/calendar-events/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function entityPath(id: number) {
    return `/calendar-events/${id}`;
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
