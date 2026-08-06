import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

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

const tagIdsSchema = z
    .array(z.number().int().positive())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
        message: "tagIds must not contain duplicates"
    });

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

const eventFields = {
    startDate: dateInput,
    endDate: dateInput.optional(),
    description: z.string().trim().min(1),
    tagIds: tagIdsSchema
};

const createBody = z
    .object(eventFields)
    .strict()
    .superRefine((event, context) => {
        if (event.endDate && event.startDate > event.endDate) {
            context.addIssue({
                code: "custom",
                path: ["startDate"],
                message: "startDate must be before or equal to endDate"
            });
        }
    });

const patchBody = z
    .object({
        startDate: dateInput.optional(),
        endDate: dateInput.nullable().optional(),
        description: z.string().trim().min(1).optional(),
        tagIds: tagIdsSchema.optional()
    })
    .strict();

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    output: new OutputBuilder()
        .ok(schema, "Calendar event retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({
            startDate: dateInput.optional(),
            endDate: dateInput.optional(),
            tagId: tagIdsQuerySchema.optional()
        })
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of calendar events retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createBody
    }),
    output: new OutputBuilder()
        .created(schema, "Calendar event created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        }),
        body: patchBody
    }),
    output: new OutputBuilder()
        .ok(schema, "Calendar event updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    output: new OutputBuilder()
        .noContent("Calendar event deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema,
    get,
    list,
    create,
    patch,
    remove
};
