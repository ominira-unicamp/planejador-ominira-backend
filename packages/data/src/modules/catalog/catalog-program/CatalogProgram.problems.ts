import {
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    defineProblem,
    prefixPaths,
    prefixProblemFields,
    problemResponse,
    type ProblemField,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

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

export const SpecializationNotInProgramProblem = defineProblem({
    schemaName: "SpecializationNotInProgramProblem",
    typeName: "specialization-not-in-program",
    title: "Habilitação não disponível",
    status: 422,
    extensions: {
        program: programReferenceSchema,
        specializations: z.array(specializationReferenceSchema)
    }
});

export function catalogProgramNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "O programa de catálogo solicitado não foi encontrado."
    });
}

export function relatedReferenceNotFoundProblem(
    fields: ProblemField[],
    detail = "Uma ou mais referências informadas não foram encontradas."
) {
    return ReferenceNotFoundProblem.create({ detail, fields });
}

export function catalogProgramAlreadyExistsProblem(
    catalog: { year: number },
    program: z.infer<typeof programReferenceSchema>
) {
    return UniqueConstraintConflictProblem.create({
        detail: `O programa ${program.code} - ${program.name} já está incluído no Catálogo ${catalog.year}.`,
        fields: [
            {
                code: "ALREADY_EXISTS",
                path: ["catalogId"],
                message: "Este catálogo já possui o programa informado."
            },
            {
                code: "ALREADY_EXISTS",
                path: ["programId"],
                message: "Este programa já está incluído no catálogo informado."
            }
        ]
    });
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
    return SpecializationNotInProgramProblem.create({
        detail: `A habilitação ${labels} não pertence ao programa ${program.code} - ${program.name}.`,
        program,
        specializations
    });
}

export type CatalogProgramProblem =
    | ReturnType<typeof catalogProgramNotFoundProblem>
    | ReturnType<typeof relatedReferenceNotFoundProblem>
    | ReturnType<typeof catalogProgramAlreadyExistsProblem>
    | ReturnType<typeof specializationNotInProgramProblem>;

export const catalogProgramProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [SpecializationNotInProgramProblem.type]: problemResponse(
        SpecializationNotInProgramProblem,
        (problem, context: ProblemResponseContext) => ({
            ...problem,
            specializations: prefixPaths(
                problem.specializations,
                context.inputLocation
            )
        })
    )
} satisfies ProblemResponseMap<CatalogProgramProblem, ProblemResponseContext>;
