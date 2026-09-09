import { OutputBuilder, type IO } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    filterDefinition,
    resourceFilterSchema,
    type Filter
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("catalog-program")];
const tags = ["catalog-program"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const CourseBlockType = {
    mandatory: "mandatory",
    elective: "elective"
} as const;

export const CourseRequirementType = {
    any: "any",
    prefix: "prefix",
    specific: "specific"
} as const;

const courseRequirementSchema = z.object({
    id: z.number().int(),
    type: z.enum(CourseRequirementType),
    courseId: z.number().int().nullable(),
    courseCode: z.string().nullable(),
    courseName: z.string().nullable(),
    prefix: z.string().nullable(),
    catalogCourseId: z.number().int().nullable(),
    _paths: z.object({ catalogCourse: z.string().nullable() }).strict()
});

const electiveBlockSchema = z.object({
    credits: z.number().int(),
    courses: z.array(courseRequirementSchema)
});

const courseBlockSetSchema = z.object({
    mandatory: z.array(courseRequirementSchema),
    electives: z.array(electiveBlockSchema)
});

const catalogProgramEntity = z
    .object({
        id: z.number().int(),
        catalogId: z.number().int(),
        programId: z.number().int(),
        title: z.string(),
        catalogYear: z.number().int(),
        programCode: z.number().int(),
        programName: z.string(),
        base: courseBlockSetSchema,
        modalities: z.array(
            z.object({
                specializationId: z.number().int(),
                curriculumSuggestionId: z.number().int().nullable(),
                code: z.string(),
                name: z.string(),
                blocks: courseBlockSetSchema
            })
        ),
        languages: z.array(
            z.object({
                languageId: z.number().int(),
                name: z.string(),
                blocks: courseBlockSetSchema
            })
        ),
        _paths: z.object({
            self: z.string(),
            catalog: z.string(),
            program: z.string(),
            curriculumSuggestions: z.string()
        })
    })
    .strict()
    .openapi("CatalogProgramEntity");

export type CatalogProgramFilter = Filter;

const catalogProgramFilterDefinitions = {
    catalogId: filterDefinition.id(),
    catalogYear: filterDefinition.integer(),
    programId: filterDefinition.id(),
    programCode: filterDefinition.integer()
};
export type CatalogProgramFilterName =
    keyof typeof catalogProgramFilterDefinitions;

const catalogProgramFilter = resourceFilterSchema(
    catalogProgramFilterDefinitions,
    "catalog programs",
    "Structured catalog program filters. Use bracket notation such as filter[catalogYear]=2025.",
    { catalogYear: 2025, programCode: 34 }
);

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(catalogProgramEntity, "Catalog program retrieved successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Programa de catálogo não encontrado"
        )
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z
            .object({
                filter: catalogProgramFilter.optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(
            z.array(catalogProgramEntity),
            "List of catalog programs retrieved successfully"
        )
        .build()
} satisfies IO;

export default {
    get,
    list,
    schemas: {
        catalogProgramEntity,
        courseRequirementSchema,
        electiveBlockSchema,
        courseBlockSetSchema
    }
};
