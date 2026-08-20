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

export const InvalidStudentAbsenceProblem = defineProblem({
    schemaName: "InvalidStudentAbsenceProblem",
    typeName: "invalid-student-absence",
    title: "Falta inválida",
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

export function studentAbsenceNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "A falta solicitada não foi encontrada."
    });
}

export function studentAbsenceReferenceNotFoundProblem(fields: ProblemField[]) {
    return ReferenceNotFoundProblem.create({
        detail: "Uma ou mais referências da falta não foram encontradas.",
        fields
    });
}

export function invalidStudentAbsenceProblem(fields: ProblemField[]) {
    return InvalidStudentAbsenceProblem.create({
        detail: "A falta não é compatível com a tentativa, o horário ou a data.",
        fields
    });
}

export function duplicateStudentAbsenceProblem() {
    return UniqueConstraintConflictProblem.create({
        detail: "Já existe uma falta registrada para esta tentativa, horário e data.",
        fields: [
            {
                code: "ALREADY_EXISTS",
                path: ["courseAttemptId", "classScheduleId", "date"],
                message: "A falta já foi registrada."
            }
        ]
    });
}

export type StudentAbsenceProblem =
    | ReturnType<typeof studentAbsenceNotFoundProblem>
    | ReturnType<typeof studentAbsenceReferenceNotFoundProblem>
    | ReturnType<typeof invalidStudentAbsenceProblem>
    | ReturnType<typeof duplicateStudentAbsenceProblem>;

export const studentAbsenceProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(ReferenceNotFoundProblem),
    [InvalidStudentAbsenceProblem.type]: problemResponse(
        InvalidStudentAbsenceProblem
    ),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem
    )
} satisfies ProblemResponseMap<StudentAbsenceProblem, object>;
