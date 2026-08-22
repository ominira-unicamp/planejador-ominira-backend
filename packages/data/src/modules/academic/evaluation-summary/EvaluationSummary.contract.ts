import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
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
    request: z.object({ query: paginationQuerySchema }),
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
    request: z.object({ query: paginationQuerySchema }),
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
        query: z
            .object({
                courseId: z.coerce.number().int(),
                professorId: z.coerce.number().int()
            })
            .strict()
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
