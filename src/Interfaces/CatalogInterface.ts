import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("catalogs")];
const tags = ["catalogs"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const catalogEntitySchema = z
    .object({
        id: z.number().int().openapi({ example: 1 }),
        year: z.number().int().openapi({ example: 2024 }),
        programsCount: z.number().int().openapi({ example: 5 }),
        studentsCount: z.number().int().openapi({ example: 150 }),
        programIds: z.array(z.number().int()).openapi({ example: [1, 2, 3] }),
        links: z.object({
            self: z.string().openapi({ example: "/catalogs/1" })
        })
    })
    .openapi("Catalog");

const get = {
    specs: {
        method: "get",
        path: basePath.concat([pathSeg.param("id")]),
        tags
    },
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(catalogEntitySchema, "Catalog retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z.object({
            year: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int())
                .optional()
        })
    }),
    output: new OutputBuilder()
        .ok(
            z.array(catalogEntitySchema),
            "List of catalogs retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: z
            .object({
                year: z.number().int().min(1900).max(2100)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(catalogEntitySchema, "Catalog created successfully")
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
                year: z.number().int().min(1900).max(2100)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(catalogEntitySchema, "Catalog updated successfully")
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
        .noContent("Catalog deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    get,
    list,
    create,
    patch,
    remove,
    schemas: {
        catalogEntitySchema
    }
};
