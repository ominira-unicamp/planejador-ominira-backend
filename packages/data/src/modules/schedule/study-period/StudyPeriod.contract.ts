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

export const studyPeriodPaths = {
    entity: (id: number) => `/study-periods/${id}`
};

const basePath = [pathSeg.literal("study-periods")];
const tags = ["study-periods"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const studyPeriodEntity = z
    .object({
        id: z.number().int(),
        year: z.number().int(),
        yearPeriod: z.enum([
            "SUMMER",
            "FIRST_SEMESTER",
            "WINTER",
            "SECOND_SEMESTER"
        ]),
        startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
        _paths: z.object({
            classes: z.string(),
            classSchedules: z.string()
        })
    })
    .strict()
    .openapi("StudyPeriodEntity");

export type StudyPeriodFilter = Filter;
const studyPeriodFilterDefinitions = {
    id: filterDefinition.id(),
    year: filterDefinition.integer(),
    yearPeriod: filterDefinition.enum([
        "SUMMER",
        "FIRST_SEMESTER",
        "WINTER",
        "SECOND_SEMESTER"
    ])
};
export type StudyPeriodFilterName = keyof typeof studyPeriodFilterDefinitions;
const studyPeriodFilter = resourceFilterSchema(
    studyPeriodFilterDefinitions,
    "study periods",
    "Structured study period filters. Use bracket notation such as filter[year]=2025."
);

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(studyPeriodEntity, "Study period retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.public,
        queryFeatures: { filter: true }
    },
    request: z.object({
        query: z.object({ filter: studyPeriodFilter.optional() }).strict()
    }),
    response: new OutputBuilder()
        .ok(
            z.array(studyPeriodEntity),
            "List of study periods retrieved successfully"
        )
        .build()
} satisfies IO;

export default {
    schema: studyPeriodEntity,
    get,
    list
};
