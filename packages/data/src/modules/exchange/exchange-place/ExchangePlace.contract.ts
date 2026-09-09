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

const specsBuilder = new SpecBuilder(
    [pathSeg.literal("exchange-places")],
    ["exchange-places"],
    "id"
);

const schema = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        _paths: z.object({ notices: z.string() }).strict()
    })
    .strict()
    .openapi("ExchangePlaceListItem");

export type ExchangePlaceFilter = Filter;
const exchangePlaceFilterDefinitions = {
    id: filterDefinition.id({ positive: true }),
    name: filterDefinition.code({ operators: ["eq"] })
};
export type ExchangePlaceFilterName =
    keyof typeof exchangePlaceFilterDefinitions;
const exchangePlaceFilter = resourceFilterSchema(
    exchangePlaceFilterDefinitions,
    "exchange places",
    "Structured exchange place filters. Use bracket notation such as filter[name]=França."
);

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({ filter: exchangePlaceFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of exchange places retrieved successfully")
        .build()
} satisfies IO;

export default { schema, list };
