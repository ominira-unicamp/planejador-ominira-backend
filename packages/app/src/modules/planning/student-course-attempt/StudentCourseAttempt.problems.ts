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

export const InvalidStudentCourseAttemptProblem = defineProblem({
    schemaName: "InvalidStudentCourseAttemptProblem",
    typeName: "invalid-student-course-attempt",
    title: "Tentativa de disciplina inválida",
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

export function studentCourseAttemptNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "A tentativa de disciplina solicitada não foi encontrada."
    });
}

export function studentCourseReferenceNotFoundProblem(fields: ProblemField[]) {
    return ReferenceNotFoundProblem.create({
        detail: "Uma ou mais referências da tentativa de disciplina não foram encontradas.",
        fields
    });
}

export function invalidStudentCourseAttemptProblem(fields: ProblemField[]) {
    return InvalidStudentCourseAttemptProblem.create({
        detail: "A turma e o período informados não são compatíveis com a disciplina.",
        fields
    });
}

export function activeStudentCourseAttemptProblem() {
    return UniqueConstraintConflictProblem.create({
        detail: "Já existe uma tentativa cursando para esta disciplina.",
        fields: [
            {
                code: "ALREADY_EXISTS",
                path: ["status"],
                message: "A disciplina já possui uma tentativa cursando."
            }
        ]
    });
}

export type StudentCourseAttemptProblem =
    | ReturnType<typeof studentCourseAttemptNotFoundProblem>
    | ReturnType<typeof studentCourseReferenceNotFoundProblem>
    | ReturnType<typeof invalidStudentCourseAttemptProblem>
    | ReturnType<typeof activeStudentCourseAttemptProblem>;

export const studentCourseAttemptProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(ReferenceNotFoundProblem),
    [InvalidStudentCourseAttemptProblem.type]: problemResponse(
        InvalidStudentCourseAttemptProblem
    ),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem
    )
} satisfies ProblemResponseMap<StudentCourseAttemptProblem, object>;
