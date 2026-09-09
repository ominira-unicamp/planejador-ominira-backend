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

const basePath = [pathSeg.literal("exchange-notices")];
const specsBuilder = new SpecBuilder(basePath, ["exchange-notices"], "id");
const placeSchema = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        _paths: z.object({ notices: z.string() }).strict()
    })
    .strict()
    .openapi("ExchangePlace");

const fileSchema = z
    .object({
        id: z.number().int().positive(),
        name: z.string(),
        url: z.string().url().nullable()
    })
    .strict()
    .openapi("ExchangeNoticeFile");

const schema = z
    .object({
        id: z.number().int().positive(),
        number: z.string().nullable(),
        issuer: z.string().nullable(),
        title: z.string().nullable(),
        place: placeSchema.nullable(),
        registrationOriginalText: z.string().nullable(),
        registrationStart: z.iso.date().nullable(),
        registrationEnd: z.iso.date().nullable(),
        files: z.array(fileSchema),
        _paths: z.object({ self: z.string() }).strict()
    })
    .strict()
    .openapi("ExchangeNotice");

export type ExchangeNoticeFilter = Filter;
const exchangeNoticeFilterDefinitions = {
    placeId: filterDefinition.id({ positive: true }),
    placeName: filterDefinition.code({ operators: ["eq"] }),
    registrationStart: filterDefinition.date({ operators: ["gte", "lte"] }),
    registrationEnd: filterDefinition.date({ operators: ["gte", "lte"] })
};
export type ExchangeNoticeFilterName =
    keyof typeof exchangeNoticeFilterDefinitions;
const exchangeNoticeFilter = resourceFilterSchema(
    exchangeNoticeFilterDefinitions,
    "exchange notices",
    "Structured exchange notice filters. Use bracket notation such as filter[registrationEnd][gte]=2026-01-01."
);

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
        .ok(schema, "Exchange notice retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const listQuery = z
    .object({ filter: exchangeNoticeFilter.optional() })
    .strict();

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({ query: listQuery }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of exchange notices retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

export default { schema, get, list };
