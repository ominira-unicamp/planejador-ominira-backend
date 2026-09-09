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

export const unitPaths = {
    entity: (id: number) => `/units/${id}`
};

const basePath = [pathSeg.literal("units")];
const tags = ["units"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const unitEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
        _paths: z
            .object({
                classes: z.string(),
                courses: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("UnitEntity");

export type UnitFilter = Filter;
const unitFilterDefinitions = {
    id: filterDefinition.id(),
    code: filterDefinition.code(),
    name: filterDefinition.code({ operators: ["eq"] })
};
export type UnitFilterName = keyof typeof unitFilterDefinitions;
const unitFilter = resourceFilterSchema(
    unitFilterDefinitions,
    "units",
    "Structured unit filters. Use bracket notation such as filter[code]=IC."
);

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(unitEntity, "Unit retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({ filter: unitFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(z.array(unitEntity), "List of units retrieved successfully")
        .build()
} satisfies IO;

export default {
    schema: unitEntity,
    get,
    list
};
