import {
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    defineProblem,
    problemResponse,
    type ProblemField,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

export const InvalidStudentProfileProblem = defineProblem({
    schemaName: "InvalidStudentProfileProblem",
    typeName: "invalid-student-profile",
    title: "Perfil de aluno inválido",
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

export const studentNotFoundProblem = () =>
    ResourceNotFoundProblem.create({
        detail: "O aluno solicitado não foi encontrado."
    });
export const studentReferenceNotFoundProblem = (fields: ProblemField[]) =>
    ReferenceNotFoundProblem.create({
        detail: "Uma ou mais referências do perfil do aluno não foram encontradas.",
        fields
    });
export const invalidStudentProfileProblem = (fields: ProblemField[]) =>
    InvalidStudentProfileProblem.create({
        detail: "As informações acadêmicas do aluno não são compatíveis entre si.",
        fields
    });
export const studentIdentityConflictProblem = (
    detail: string,
    path: string[] = []
) =>
    UniqueConstraintConflictProblem.create({
        detail,
        fields:
            path.length === 0
                ? []
                : [{ code: "ALREADY_EXISTS", path, message: detail }]
    });

export type StudentProblem =
    | ReturnType<typeof studentNotFoundProblem>
    | ReturnType<typeof studentReferenceNotFoundProblem>
    | ReturnType<typeof invalidStudentProfileProblem>
    | ReturnType<typeof studentIdentityConflictProblem>;
export const studentProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(ReferenceNotFoundProblem),
    [InvalidStudentProfileProblem.type]: problemResponse(
        InvalidStudentProfileProblem
    ),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem
    )
} satisfies ProblemResponseMap<StudentProblem, object>;
