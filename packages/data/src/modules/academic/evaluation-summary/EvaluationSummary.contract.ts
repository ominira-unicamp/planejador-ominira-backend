import { OutputBuilder, type IO } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    filterDefinition,
    resourceFilterSchema,
    type Filter
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    pathSeg
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const metrics = z
    .object({
        responseCount: z.number().int().min(5),
        wouldTakeAgain: z.number(),
        fairness: z.number(),
        clarity: z.number(),
        difficulty: z.number()
    })
    .strict();

const professor = z.object({ id: z.number().int(), name: z.string() }).strict();

const course = z
    .object({ id: z.number().int(), code: z.string(), name: z.string() })
    .strict();

const professorSummary = metrics
    .extend({ professor })
    .strict()
    .openapi("ProfessorEvaluationSummary");

const courseSummary = metrics
    .extend({ course })
    .strict()
    .openapi("CourseEvaluationSummary");

const pairSummary = metrics
    .extend({ course, professor })
    .strict()
    .openapi("CourseProfessorEvaluationSummary");

const pairFilter = resourceFilterSchema(
    {
        courseId: filterDefinition.id({ positive: true }),
        professorId: filterDefinition.id({ positive: true })
    },
    "evaluation summary pair",
    "Structured evaluation summary filters. Use filter[courseId]=1&filter[professorId]=2."
).superRefine((filter: Filter, context) => {
    const fields = new Set(filter.map((expression) => expression.path[0]));
    for (const field of ["courseId", "professorId"]) {
        if (!fields.has(field)) {
            context.addIssue({
                code: "custom",
                message: `${field} is required`
            });
        }
    }
});

const professorSummaryFilter = resourceFilterSchema(
    { professorId: filterDefinition.id({ positive: true }) },
    "professor evaluation summaries",
    "Structured professor summary filters. Use filter[professorId]=1."
);
const courseSummaryFilter = resourceFilterSchema(
    {
        courseId: filterDefinition.id({ positive: true }),
        courseCode: filterDefinition.code()
    },
    "course evaluation summaries",
    "Structured course summary filters. Use filter[courseCode]=MC102."
);

const professorSummaries = {
    meta: {
        method: "get" as const,
        path: [
            pathSeg.literal("professors"),
            pathSeg.literal("evaluation-summaries")
        ],
        tags: ["evaluation-summaries"],
        authorization: policies.public
    },
    request: z.object({
        query: paginationQuerySchema.extend({
            filter: professorSummaryFilter.optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(professorSummary).openapi(
                "PageProfessorEvaluationSummaries"
            ),
            "Sumários de avaliações por professor"
        )
        .badRequest()
        .build()
} satisfies IO;

const courseSummaries = {
    meta: {
        method: "get" as const,
        path: [
            pathSeg.literal("courses"),
            pathSeg.literal("evaluation-summaries")
        ],
        tags: ["evaluation-summaries"],
        authorization: policies.public
    },
    request: z.object({
        query: paginationQuerySchema.extend({
            filter: courseSummaryFilter.optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            getPaginatedSchema(courseSummary).openapi(
                "PageCourseEvaluationSummaries"
            ),
            "Sumários de avaliações por disciplina"
        )
        .badRequest()
        .build()
} satisfies IO;

const pair = {
    meta: {
        method: "get" as const,
        path: [pathSeg.literal("evaluation-summaries")],
        tags: ["evaluation-summaries"],
        authorization: policies.public
    },
    request: z.object({
        query: z.object({ filter: pairFilter }).strict()
    }),
    response: new OutputBuilder()
        .ok(pairSummary, "Sumário de avaliações por professor e disciplina")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

export default {
    professorSummary,
    courseSummary,
    pairSummary,
    professorSummaries,
    courseSummaries,
    pair
};
