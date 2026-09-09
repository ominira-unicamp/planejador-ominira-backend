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

const basePath = [pathSeg.literal("specializations")];
const tags = ["specializations"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");
const positiveId = z.number().int().positive();

const schema = z
    .object({
        id: positiveId,
        programId: positiveId,
        programCode: z.number().int().positive(),
        programName: z.string().trim().min(1),
        code: z.string(),
        name: z.string(),
        catalogSpecializationsCount: z.number().int(),
        studentsCount: z.number().int(),
        _paths: z.object({
            self: z.string(),
            program: z.string()
        })
    })
    .openapi("Specialization");

export type SpecializationFilter = Filter;
const specializationFilterDefinitions = {
    programId: filterDefinition.id({ positive: true }),
    programCode: filterDefinition.integer({ minimum: 1 }),
    code: filterDefinition.code({ uppercase: true })
};
export type SpecializationFilterName =
    keyof typeof specializationFilterDefinitions;
const specializationFilter = resourceFilterSchema(
    specializationFilterDefinitions,
    "specializations",
    "Structured specialization filters. Use bracket notation such as filter[programId]=1."
);

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Specialization retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({ filter: specializationFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of specializations retrieved successfully")
        .build()
} satisfies IO;
export default {
    schema,
    get,
    list
};
