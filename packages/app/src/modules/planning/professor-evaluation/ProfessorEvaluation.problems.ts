import {
    ReferenceNotFoundProblem,
    defineProblem,
    problemResponse,
    type ProblemField,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

export const InvalidProfessorEvaluationProblem = defineProblem({
    schemaName: "InvalidProfessorEvaluationProblem",
    typeName: "invalid-professor-evaluation",
    title: "Avaliação de professor inválida",
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

export function professorEvaluationReferenceNotFoundProblem(
    fields: ProblemField[]
) {
    return ReferenceNotFoundProblem.create({
        detail: "Uma ou mais referências da avaliação não foram encontradas.",
        fields
    });
}

export function invalidProfessorEvaluationProblem(fields: ProblemField[]) {
    return InvalidProfessorEvaluationProblem.create({
        detail: "O estudante não pode avaliar este professor nesta turma.",
        fields
    });
}

export type ProfessorEvaluationProblem =
    | ReturnType<typeof professorEvaluationReferenceNotFoundProblem>
    | ReturnType<typeof invalidProfessorEvaluationProblem>;

export const professorEvaluationProblemResponses = {
    [ReferenceNotFoundProblem.type]: problemResponse(ReferenceNotFoundProblem),
    [InvalidProfessorEvaluationProblem.type]: problemResponse(
        InvalidProfessorEvaluationProblem
    )
} satisfies ProblemResponseMap<ProfessorEvaluationProblem, object>;
