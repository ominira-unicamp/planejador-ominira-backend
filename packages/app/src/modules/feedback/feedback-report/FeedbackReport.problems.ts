import {
    ReferenceNotFoundProblem,
    defineProblem,
    prefixProblemFields,
    problemResponse,
    type ProblemField,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

export const InvalidFeedbackReportProblem = defineProblem({
    schemaName: "InvalidFeedbackReportProblem",
    typeName: "invalid-feedback-report",
    title: "Feedback inválido",
    status: 422,
    extensions: {
        fields: z.array(
            z
                .object({
                    code: z.string(),
                    path: z.array(z.string()),
                    message: z.string()
                })
                .strict()
        )
    }
});

export const FeedbackRateLimitProblem = defineProblem({
    schemaName: "FeedbackRateLimitProblem",
    typeName: "feedback-rate-limit",
    title: "Muitos envios de feedback",
    status: 429,
    extensions: { retryAfterSeconds: z.number().int().positive() }
});

export const feedbackReferenceNotFoundProblem = (fields: ProblemField[]) =>
    ReferenceNotFoundProblem.create({
        detail: "O dado acadêmico informado não foi encontrado.",
        fields
    });

export const invalidFeedbackReportProblem = (fields: ProblemField[]) =>
    InvalidFeedbackReportProblem.create({
        detail: "As informações do feedback são inválidas.",
        fields
    });

export const feedbackRateLimitProblem = (retryAfterSeconds: number) =>
    FeedbackRateLimitProblem.create({
        detail: "Aguarde antes de enviar outro feedback.",
        retryAfterSeconds
    });

export type FeedbackReportProblem =
    | ReturnType<typeof feedbackReferenceNotFoundProblem>
    | ReturnType<typeof invalidFeedbackReportProblem>
    | ReturnType<typeof feedbackRateLimitProblem>;

export const feedbackReportProblemResponses = {
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [InvalidFeedbackReportProblem.type]: problemResponse(
        InvalidFeedbackReportProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [FeedbackRateLimitProblem.type]: problemResponse(FeedbackRateLimitProblem)
} satisfies ProblemResponseMap<FeedbackReportProblem, ProblemResponseContext>;
