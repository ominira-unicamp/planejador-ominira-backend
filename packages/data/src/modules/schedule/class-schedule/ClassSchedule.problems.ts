import {
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    prefixProblemFields,
    problemResponse,
    type ProblemField,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";

export function classScheduleNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "O horário de turma solicitado não foi encontrado."
    });
}

export function classScheduleReferenceNotFoundProblem(
    fields: Array<Omit<ProblemField, "code">>
) {
    return ReferenceNotFoundProblem.create({
        detail: "Revise as referências informadas e tente novamente.",
        fields: fields.map((field) => ({
            code: "REFERENCE_NOT_FOUND",
            ...field
        }))
    });
}

export type ClassScheduleProblem =
    | ReturnType<typeof classScheduleNotFoundProblem>
    | ReturnType<typeof classScheduleReferenceNotFoundProblem>;

export const classScheduleProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    )
} satisfies ProblemResponseMap<ClassScheduleProblem, ProblemResponseContext>;
