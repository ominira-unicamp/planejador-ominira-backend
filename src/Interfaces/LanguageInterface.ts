import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("languages")];
const tags = ["languages"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        name: z.string(),
        catalogLanguagesCount: z.number().int(),
        _paths: z.object({
            self: z.string()
        })
    })
    .openapi("Language");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(schema, "Language retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({})
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of languages retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: z
            .object({
                name: z.string().min(1)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(schema, "Language created successfully")
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
                name: z.string().min(1)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(schema, "Language updated successfully")
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
        .noContent("Language deleted successfully")
        .notFound()
        .build()
};

export default {
    schema,
    get,
    list,
    create,
    patch,
    remove
};
