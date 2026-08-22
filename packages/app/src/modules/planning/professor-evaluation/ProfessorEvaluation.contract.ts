import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidProfessorEvaluationProblem } from "#/modules/planning/professor-evaluation/ProfessorEvaluation.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, ReferenceNotFoundProblemSchema } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("classes"),
    pathSeg.param("classId"),
    pathSeg.literal("professors"),
    pathSeg.param("professorId"),
    pathSeg.literal("evaluation")
];

const path = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int()),
    classId: z.string().pipe(z.coerce.number()).pipe(z.number().int()),
    professorId: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});

const score = z.number().int().min(1).max(5);

const evaluationBody = z
    .object({
        wouldTakeAgain: score,
        fairness: score,
        clarity: score,
        difficulty: score
    })
    .strict()
    .openapi("ProfessorEvaluationBody");

const evaluation = evaluationBody
    .extend({
        id: z.number().int(),
        studentId: z.number().int(),
        classId: z.number().int(),
        professorId: z.number().int(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime()
    })
    .strict()
    .openapi("ProfessorEvaluation");

const eligibility = z
    .object({
        eligible: z.boolean(),
        evaluation: evaluation.nullable()
    })
    .strict()
    .openapi("ProfessorEvaluationEligibility");

const invalidEvaluationResponse = z.discriminatedUnion("type", [
    ReferenceNotFoundProblemSchema,
    InvalidProfessorEvaluationProblem.schema
]);

const get = {
    meta: {
        method: "get" as const,
        path: basePath,
        tags: ["professor-evaluations"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_READ
        )
    },
    request: z.object({ path }),
    response: new OutputBuilder()
        .ok(eligibility, "Elegibilidade de avaliação recuperada")
        .problem(422, invalidEvaluationResponse, "Avaliação inválida")
        .build()
} satisfies IO;

const put = {
    meta: {
        method: "put" as const,
        path: basePath,
        tags: ["professor-evaluations"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_WRITE
        )
    },
    request: z.object({ path, body: evaluationBody }),
    response: new OutputBuilder()
        .ok(evaluation, "Avaliação atualizada")
        .problem(422, invalidEvaluationResponse, "Avaliação inválida")
        .build()
} satisfies IO;

export default { schema: evaluation, get, put };
