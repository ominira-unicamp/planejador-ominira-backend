import { ResourceNotFoundProblem, problemResponse } from "@pomi/api-core";

export function courseNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "A disciplina não foi encontrada."
    });
}

export const courseProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem)
};
