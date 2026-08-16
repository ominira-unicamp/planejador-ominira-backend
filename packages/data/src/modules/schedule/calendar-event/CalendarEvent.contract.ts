import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("calendar-events")];
const tags = ["calendar-events"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const dateInput = z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .pipe(z.coerce.date());

const dateOutput = z.union([z.string(), z.date()]).pipe(z.coerce.date());

const calendarTagSchema = z
    .object({
        id: z.number().int(),
        name: z.string()
    })
    .strict();

const tagIdsQuerySchema = z
    .union([z.string(), z.array(z.string())])
    .transform((tagIds) => (Array.isArray(tagIds) ? tagIds : [tagIds]))
    .pipe(
        z
            .array(
                z
                    .string()
                    .pipe(z.coerce.number())
                    .pipe(z.number().int().positive())
            )
            .min(1)
            .refine((tagIds) => new Set(tagIds).size === tagIds.length, {
                message: "tagId must not contain duplicates"
            })
    );

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
        query: z.object({
            startDate: dateInput.optional(),
            endDate: dateInput.optional(),
            tagId: tagIdsQuerySchema.optional()
        })
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
