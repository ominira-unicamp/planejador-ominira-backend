import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { pathSeg } from "#/PathSegment.js";
import { SpecBuilder } from "#/SpecBuilder.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("calendar-tags")];
const tags = ["calendar-tags"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        name: z.string(),
        _paths: z.object({
            entity: z.string()
        })
    })
    .strict()
    .openapi("CalendarTag");

const nameSchema = z.string().trim().min(1);

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
        .ok(schema, "Calendar tag retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({})
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of calendar tags retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: z
            .object({
                name: nameSchema
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(schema, "Calendar tag created successfully")
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
        body: z
            .object({
                name: nameSchema
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(schema, "Calendar tag updated successfully")
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
        .noContent("Calendar tag deleted successfully")
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
