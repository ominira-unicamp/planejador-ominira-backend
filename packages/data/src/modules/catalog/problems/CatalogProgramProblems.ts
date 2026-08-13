import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { ProblemDetailsSchema, problemType } from "@pomi/api-core";
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
        path: z.array(z.string())
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

export function catalogProgramNotFoundProblem(instance?: string) {
    return {
        type: problemType("catalog-program-not-found"),
        title: "Programa de catálogo não encontrado",
        status: 404,
        detail: "O programa de catálogo solicitado não foi encontrado.",
        ...(instance ? { instance } : {})
    } as z.infer<typeof CatalogProgramNotFoundProblemSchema>;
}

export function catalogProgramAlreadyExistsProblem(
    catalog: { id: number; year: number },
    program: z.infer<typeof programReferenceSchema>,
    instance?: string
) {
    return {
        type: problemType("catalog-program-already-exists"),
        title: "Programa já incluído no catálogo",
        status: 409,
        detail: `O programa ${program.code} - ${program.name} já está incluído no Catálogo ${catalog.year}.`,
        ...(instance ? { instance } : {}),
        catalog,
        program
    } as z.infer<typeof CatalogProgramAlreadyExistsProblemSchema>;
}

export function specializationNotInProgramProblem(
    program: z.infer<typeof programReferenceSchema>,
    specializations: z.infer<typeof specializationReferenceSchema>[],
    instance?: string
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
        status: 422,
        detail: `A habilitação ${labels} não pertence ao programa ${program.code} - ${program.name}.`,
        ...(instance ? { instance } : {}),
        program,
        specializations
    } as z.infer<typeof SpecializationNotInProgramProblemSchema>;
}
