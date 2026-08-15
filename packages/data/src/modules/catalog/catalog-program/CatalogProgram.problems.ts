import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    ProblemDetailsSchema,
    problemDetails,
    problemType
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const programReferenceSchema = z
    .object({
        id: z.number().int(),
        code: z.number().int(),
        name: z.string()
    })
    .strict();

const specializationReferenceSchema = z
    .object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
        path: z.array(z.string()).openapi({
            description:
                "Caminho do campo na requisição HTTP que originou o problema."
        })
    })
    .strict();

export const CatalogProgramNotFoundProblemSchema = ProblemDetailsSchema.extend({
    type: z.literal(problemType("catalog-program-not-found")),
    title: z.literal("Programa de catálogo não encontrado"),
    status: z.literal(404)
})
    .strict()
    .openapi("CatalogProgramNotFoundProblem");

export const CatalogProgramAlreadyExistsProblemSchema =
    ProblemDetailsSchema.extend({
        type: z.literal(problemType("catalog-program-already-exists")),
        title: z.literal("Programa já incluído no catálogo"),
        status: z.literal(409),
        catalog: z
            .object({ id: z.number().int(), year: z.number().int() })
            .strict(),
        program: programReferenceSchema
    })
        .strict()
        .openapi("CatalogProgramAlreadyExistsProblem");

export const SpecializationNotInProgramProblemSchema =
    ProblemDetailsSchema.extend({
        type: z.literal(problemType("specialization-not-in-program")),
        title: z.literal("Habilitação não disponível"),
        status: z.literal(422),
        program: programReferenceSchema,
        specializations: z.array(specializationReferenceSchema)
    })
        .strict()
        .openapi("SpecializationNotInProgramProblem");

export function catalogProgramNotFoundProblem() {
    return {
        type: problemType("catalog-program-not-found"),
        title: "Programa de catálogo não encontrado",
        detail: "O programa de catálogo solicitado não foi encontrado."
    } as const;
}

export function relatedResourceNotFoundProblem(detail: string) {
    return {
        type: problemType("resource-not-found"),
        title: "Recurso não encontrado",
        detail
    } as const;
}

export function catalogProgramAlreadyExistsProblem(
    catalog: { id: number; year: number },
    program: z.infer<typeof programReferenceSchema>
) {
    return {
        type: problemType("catalog-program-already-exists"),
        title: "Programa já incluído no catálogo",
        detail: `O programa ${program.code} - ${program.name} já está incluído no Catálogo ${catalog.year}.`,
        catalog,
        program
    } as const;
}

export function specializationNotInProgramProblem(
    program: z.infer<typeof programReferenceSchema>,
    specializations: z.infer<typeof specializationReferenceSchema>[]
) {
    const labels = specializations
        .map(
            (specialization) =>
                `${specialization.code} - ${specialization.name}`
        )
        .join(", ");
    return {
        type: problemType("specialization-not-in-program"),
        title: "Habilitação não disponível",
        detail: `A habilitação ${labels} não pertence ao programa ${program.code} - ${program.name}.`,
        program,
        specializations
    } as const;
}

export type CatalogProgramProblem =
    | ReturnType<typeof catalogProgramNotFoundProblem>
    | ReturnType<typeof relatedResourceNotFoundProblem>
    | ReturnType<typeof catalogProgramAlreadyExistsProblem>
    | ReturnType<typeof specializationNotInProgramProblem>;

type ProblemDetailsContext = {
    instance?: string;
    inputLocation?: "body" | "query" | "path" | "headers";
};

export function catalogProgramProblemDetails(
    problem: CatalogProgramProblem,
    context: ProblemDetailsContext = {}
) {
    switch (problem.type) {
        case "urn:pomi:problem:resource-not-found":
            return problemDetails(problem, 404, context.instance);
        case "urn:pomi:problem:catalog-program-not-found":
            return problemDetails(problem, 404, context.instance);
        case "urn:pomi:problem:catalog-program-already-exists":
            return problemDetails(problem, 409, context.instance);
        case "urn:pomi:problem:specialization-not-in-program": {
            const translated = context.inputLocation
                ? {
                      ...problem,
                      specializations: problem.specializations.map(
                          (specialization) => ({
                              ...specialization,
                              path: [
                                  context.inputLocation,
                                  ...specialization.path
                              ]
                          })
                      )
                  }
                : problem;
            return problemDetails(translated, 422, context.instance);
        }
    }
}
