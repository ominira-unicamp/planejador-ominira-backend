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

const basePath = [pathSeg.literal("catalogs")];
const tags = ["catalogs"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const catalogEntitySchema = z
    .object({
        id: z.number().int().openapi({ example: 1 }),
        year: z.number().int().openapi({ example: 2024 }),
        programsCount: z.number().int().openapi({ example: 5 }),
        coursesCount: z.number().int().openapi({ example: 8996 }),
        studentsCount: z.number().int().openapi({ example: 150 }),
        programIds: z.array(z.number().int()).openapi({ example: [1, 2, 3] }),
        links: z.object({
            self: z.string().openapi({ example: "/catalogs/1" })
        }),
        _paths: z.object({ self: z.string(), courses: z.string() }).strict()
    })
    .openapi("Catalog");

export type CatalogFilter = Filter;
const catalogFilterDefinitions = { year: filterDefinition.integer() };
export type CatalogFilterName = keyof typeof catalogFilterDefinitions;
const catalogFilter = resourceFilterSchema(
    catalogFilterDefinitions,
    "catalogs",
    "Structured catalog filters. Use bracket notation such as filter[year]=2025."
);

const get = {
    meta: {
        method: "get",
        path: basePath.concat([pathSeg.param("id")]),
        tags,
        authorization: policies.public
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(catalogEntitySchema, "Catalog retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({ filter: catalogFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(
            z.array(catalogEntitySchema),
            "List of catalogs retrieved successfully"
        )
        .build()
} satisfies IO;

export default {
    get,
    list,
    schemas: {
        catalogEntitySchema
    }
};
