import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("programs")];
const tags = ["programs"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        code: z.number().int(),
        name: z.string(),
        unitId: z.number().int(),
        unit: z.object({
            id: z.number().int(),
            code: z.string()
        }),
        catalogProgramsCount: z.number().int(),
        studentsCount: z.number().int(),
        _paths: z.object({
            self: z.string(),
            unit: z.string()
        })
    })
    .openapi("Program");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(schema, "Program retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({
            unitId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int())
                .optional()
        })
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of programs retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: z
            .object({
                code: z.number().int().positive(),
                name: z.string().min(1),
                unitId: z.number().int()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(schema, "Program created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                code: z.number().int().positive().optional(),
                name: z.string().min(1).optional(),
                unitId: z.number().int().optional()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(schema, "Program updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Program deleted successfully")
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
