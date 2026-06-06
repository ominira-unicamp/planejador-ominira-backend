import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("specializations")];
const tags = ["specializations"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
        catalogSpecializationsCount: z.number().int(),
        studentsCount: z.number().int(),
        _paths: z.object({
            self: z.string()
        })
    })
    .openapi("Specialization");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(schema, "Specialization retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({})
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of specializations retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: z
            .object({
                code: z.string().min(1),
                name: z.string().min(1)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(schema, "Specialization created successfully")
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
                code: z.string().min(1).optional(),
                name: z.string().min(1).optional()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(schema, "Specialization updated successfully")
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
        .noContent("Specialization deleted successfully")
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
