import {
    ReferenceNotFoundProblem,
    prefixProblemFields,
    problemResponse,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";

export const exchangeNoticeSubscriptionProblemResponses = {
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    )
} satisfies ProblemResponseMap<
    ReturnType<typeof ReferenceNotFoundProblem.create>,
    ProblemResponseContext
>;
