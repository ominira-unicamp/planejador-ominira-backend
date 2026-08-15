import {
    ResourceNotFoundProblem,
    problemResponse,
    type ProblemResponseMap
} from "@pomi/api-core";

export const botNotFoundProblem = () =>
    ResourceNotFoundProblem.create({
        detail: "O bot solicitado não foi encontrado."
    });
export type BotGrantProblem = ReturnType<typeof botNotFoundProblem>;
export const botGrantProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
} satisfies ProblemResponseMap<BotGrantProblem, object>;
