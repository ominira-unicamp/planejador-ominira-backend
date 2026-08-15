import {
    ProblemDetailsSchema,
    ProblemFieldSchema,
    problemDetails,
    problemType
} from "@pomi/api-core";
import z from "zod";

export const ClassScheduleNotFoundProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("class-schedule-not-found")),
    title: z.literal("Horário de turma não encontrado"),
    status: z.literal(404)
}).strict();

export const ClassScheduleReferenceNotFoundProblemSchema =
    ProblemDetailsSchema.extend({
        type: z.literal(problemType("class-schedule-reference-not-found")),
        title: z.literal("Referência de horário de turma não encontrada"),
        status: z.literal(400),
        fields: z.array(ProblemFieldSchema)
    }).strict();

export function classScheduleNotFoundProblem() {
    return {
        type: problemType("class-schedule-not-found"),
        title: "Horário de turma não encontrado",
        detail: "O horário de turma solicitado não foi encontrado."
    } as const;
}

export function classScheduleReferenceNotFoundProblem(
    fields: Array<{ path: string[]; message: string }>
) {
    return {
        type: problemType("class-schedule-reference-not-found"),
        title: "Referência de horário de turma não encontrada",
        detail: "Revise as referências informadas e tente novamente.",
        fields: fields.map((field) => ({
            code: "REFERENCE_NOT_FOUND",
            ...field
        }))
    } as const;
}

export type ClassScheduleProblem =
    | ReturnType<typeof classScheduleNotFoundProblem>
    | ReturnType<typeof classScheduleReferenceNotFoundProblem>;

export function classScheduleProblemDetails(
    problem: ClassScheduleProblem,
    inputLocation?: "body"
) {
    switch (problem.type) {
        case "urn:pomi:problem:class-schedule-not-found":
            return problemDetails(problem, 404);
        case "urn:pomi:problem:class-schedule-reference-not-found":
            return problemDetails(
                inputLocation
                    ? {
                          ...problem,
                          fields: problem.fields.map((field) => ({
                              ...field,
                              path: [inputLocation, ...field.path]
                          }))
                      }
                    : problem,
                400
            );
    }
}
