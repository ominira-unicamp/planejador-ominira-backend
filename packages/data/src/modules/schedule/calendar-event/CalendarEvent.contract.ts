import { OutputBuilder, type IO } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    filterDefinition,
    resourceFilterSchema,
    type Filter
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("calendar-events")];
const tags = ["calendar-events"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const dateOutput = z.union([z.string(), z.date()]).pipe(z.coerce.date());

const calendarTagSchema = z
    .object({
        id: z.number().int(),
        name: z.string()
    })
    .strict();

const schema = z
    .object({
        id: z.number().int(),
        startDate: dateOutput,
        endDate: dateOutput.nullable(),
        description: z.string(),
        tags: z.array(calendarTagSchema),
        _paths: z.object({
            entity: z.string()
        })
    })
    .strict()
    .openapi("CalendarEvent");

export type CalendarEventFilter = Filter;
const calendarEventFilterDefinitions = {
    startDate: filterDefinition.dateTime(),
    endDate: filterDefinition.dateTime(),
    tagId: filterDefinition.id()
};
export type CalendarEventFilterName =
    keyof typeof calendarEventFilterDefinitions;
const calendarEventFilter = resourceFilterSchema(
    calendarEventFilterDefinitions,
    "calendar events",
    "Structured calendar event filters. Use bracket notation such as filter[tagId]=1."
);
const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Calendar event retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({ filter: calendarEventFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of calendar events retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

export default {
    schema,
    get,
    list
};
