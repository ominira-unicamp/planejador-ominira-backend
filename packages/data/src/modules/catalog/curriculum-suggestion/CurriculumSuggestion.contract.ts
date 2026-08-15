import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import { CurriculumSuggestionType } from "@pomi/db";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("curriculum-suggestions")];
const tags = ["curriculum-suggestions"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const positiveId = z.number().int().positive();
const pathId = z
    .string()
    .pipe(z.coerce.number())
    .pipe(z.number().int().positive());
const queryId = z.coerce.number().int().positive();
const catalogYear = z.number().int().min(1900).max(2100);
const suggestionType = z.enum(CurriculumSuggestionType);
const specializationSummary = z
    .object({
        id: positiveId,
        code: z.string().trim().min(1),
        name: z.string().trim().min(1)
    })
    .strict();

const suggestionCourseEntitySchema = z
    .object({
        id: positiveId,
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        credits: z.number().int().min(0)
    })
    .strict()
    .openapi("CurriculumSuggestionCourseEntity");

const semesterSuggestionEntitySchema = z
    .object({
        semester: z.number().int().positive(),
        electiveCredits: z.number().int().min(0),
        courses: z.array(suggestionCourseEntitySchema)
    })
    .strict()
    .openapi("SemesterSuggestionEntity");

export const curriculumSuggestionDataSchema = z
    .object({
        id: positiveId,
        catalogProgramId: positiveId,
        catalogYear,
        programId: positiveId,
        programCode: z.number().int().positive(),
        programName: z.string().trim().min(1),
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        type: suggestionType,
        specialization: specializationSummary.nullable(),
        semesters: z.array(semesterSuggestionEntitySchema)
    })
    .strict()
    .openapi("CurriculumSuggestionData");

const curriculumSuggestionEntitySchema = curriculumSuggestionDataSchema
    .extend({
        _paths: z
            .object({
                self: z.string().min(1),
                catalogProgram: z.string().min(1),
                specialization: z.string().min(1).nullable()
            })
            .strict()
    })
    .strict()
    .openapi("CurriculumSuggestionEntity");

const listQuerySchema = z
    .object({
        catalogProgramId: queryId.optional(),
        catalogId: queryId.optional(),
        catalogYear: z.coerce.number().pipe(catalogYear).optional(),
        programId: queryId.optional(),
        programCode: z.coerce.number().int().positive().optional(),
        code: z.string().trim().min(1).optional(),
        type: suggestionType.optional(),
        specializationId: queryId.optional()
    })
    .strict()
    .openapi("ListCurriculumSuggestionsQuery");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({ path: z.object({ id: pathId }).strict() }),
    response: new OutputBuilder()
        .ok(
            curriculumSuggestionEntitySchema,
            "Curriculum suggestion retrieved successfully"
        )
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Sugestão de currículo não encontrada"
        )
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({ query: listQuerySchema }),
    response: new OutputBuilder()
        .ok(
            z.array(curriculumSuggestionEntitySchema),
            "List of curriculum suggestions retrieved successfully"
        )
        .badRequest()
        .build()
} satisfies IO;

export default {
    schema: curriculumSuggestionEntitySchema,
    get,
    list,
    schemas: {
        suggestionCourseEntitySchema,
        semesterSuggestionEntitySchema,
        curriculumSuggestionDataSchema,
        specializationSummary,
        curriculumSuggestionEntitySchema,
        listQuerySchema
    }
};

export type CurriculumSuggestionEntity = z.infer<
    typeof curriculumSuggestionEntitySchema
>;
export type ListCurriculumSuggestionsQuery = z.infer<typeof listQuerySchema>;
