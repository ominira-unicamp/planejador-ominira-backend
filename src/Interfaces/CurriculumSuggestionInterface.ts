import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { CurriculumSuggestionType } from "../../prisma/generated/client.js";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

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

const curriculumSuggestionEntitySchema = z
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
        semesters: z.array(semesterSuggestionEntitySchema),
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

const suggestionCourseInputSchema = z
    .object({
        courseId: positiveId
    })
    .strict();

const semesterSuggestionInputSchema = z
    .object({
        semester: z.number().int().positive(),
        electiveCredits: z.number().int().min(0),
        courses: z.array(suggestionCourseInputSchema)
    })
    .strict();

const semestersInputSchema = z
    .array(semesterSuggestionInputSchema)
    .min(1)
    .superRefine((semesters, context) => {
        const semesterNumbers = new Set<number>();
        const courseIds = new Set<number>();

        semesters.forEach((semester, semesterIndex) => {
            if (semesterNumbers.has(semester.semester)) {
                context.addIssue({
                    code: "custom",
                    path: [semesterIndex, "semester"],
                    message: "semester must be unique within a suggestion"
                });
            }
            semesterNumbers.add(semester.semester);

            semester.courses.forEach((course, courseIndex) => {
                if (courseIds.has(course.courseId)) {
                    context.addIssue({
                        code: "custom",
                        path: [
                            semesterIndex,
                            "courses",
                            courseIndex,
                            "courseId"
                        ],
                        message: "courseId must be unique within a suggestion"
                    });
                }
                courseIds.add(course.courseId);
            });
        });
    });

const createBodySchema = z
    .object({
        catalogProgramId: positiveId,
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        type: suggestionType,
        specializationId: positiveId.nullable().optional(),
        semesters: semestersInputSchema
    })
    .strict()
    .openapi("CreateCurriculumSuggestionBody");

const patchBodySchema = z
    .object({
        code: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        type: suggestionType.optional(),
        specializationId: positiveId.nullable().optional(),
        semesters: semestersInputSchema.optional()
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
        message: "at least one field must be provided"
    })
    .openapi("PatchCurriculumSuggestionBody");

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
    specs: specsBuilder.get(),
    input: z.object({ path: z.object({ id: pathId }).strict() }),
    output: new OutputBuilder()
        .ok(
            curriculumSuggestionEntitySchema,
            "Curriculum suggestion retrieved successfully"
        )
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({ query: listQuerySchema }),
    output: new OutputBuilder()
        .ok(
            z.array(curriculumSuggestionEntitySchema),
            "List of curriculum suggestions retrieved successfully"
        )
        .badRequest()
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({ body: createBodySchema }),
    output: new OutputBuilder()
        .created(
            curriculumSuggestionEntitySchema,
            "Curriculum suggestion created successfully"
        )
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({ id: pathId }).strict(),
        body: patchBodySchema
    }),
    output: new OutputBuilder()
        .ok(
            curriculumSuggestionEntitySchema,
            "Curriculum suggestion updated successfully"
        )
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({ path: z.object({ id: pathId }).strict() }),
    output: new OutputBuilder()
        .noContent("Curriculum suggestion deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: curriculumSuggestionEntitySchema,
    get,
    list,
    create,
    patch,
    remove,
    schemas: {
        suggestionCourseEntitySchema,
        semesterSuggestionEntitySchema,
        specializationSummary,
        curriculumSuggestionEntitySchema,
        suggestionCourseInputSchema,
        semesterSuggestionInputSchema,
        semestersInputSchema,
        createBodySchema,
        patchBodySchema,
        listQuerySchema
    }
};

export type CurriculumSuggestionEntity = z.infer<
    typeof curriculumSuggestionEntitySchema
>;
export type CreateCurriculumSuggestionBody = z.infer<typeof createBodySchema>;
export type PatchCurriculumSuggestionBody = z.infer<typeof patchBodySchema>;
export type ListCurriculumSuggestionsQuery = z.infer<typeof listQuerySchema>;
