import {
    ProblemFieldSchema,
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    UniqueConstraintConflictProblem,
    defineProblem,
    prefixProblemFields,
    problemResponse,
    type ProblemField,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

export const SpecializationRequiredForSuggestionProblem = defineProblem({
    schemaName: "SpecializationRequiredForSuggestionProblem",
    typeName: "specialization-required-for-suggestion",
    title: "Habilitação necessária",
    status: 422,
    extensions: { fields: z.array(ProblemFieldSchema) }
});

export const SpecializationNotAllowedForSuggestionProblem = defineProblem({
    schemaName: "SpecializationNotAllowedForSuggestionProblem",
    typeName: "specialization-not-allowed-for-suggestion",
    title: "Habilitação não permitida",
    status: 422,
    extensions: { fields: z.array(ProblemFieldSchema) }
});

export const SpecializationNotAvailableInCatalogProgramProblem = defineProblem({
    schemaName: "SpecializationNotAvailableInCatalogProgramProblem",
    typeName: "specialization-not-available-in-catalog-program",
    title: "Habilitação indisponível no programa de catálogo",
    status: 422,
    extensions: { fields: z.array(ProblemFieldSchema) }
});

export function curriculumSuggestionNotFoundProblem() {
    return ResourceNotFoundProblem.create({
        detail: "A sugestão de currículo solicitada não foi encontrada."
    });
}

export function curriculumSuggestionReferenceNotFoundProblem(
    fields: ProblemField[],
    detail = "Uma ou mais referências informadas não foram encontradas."
) {
    return ReferenceNotFoundProblem.create({ detail, fields });
}

export function curriculumSuggestionAlreadyExistsProblem(code: string) {
    return UniqueConstraintConflictProblem.create({
        detail: `Já existe uma sugestão de currículo com o código ${code}.`,
        fields: [
            {
                code: "ALREADY_EXISTS",
                path: ["code"],
                message: "Este código já está sendo utilizado."
            }
        ]
    });
}

export function specializationRequiredForSuggestionProblem() {
    return SpecializationRequiredForSuggestionProblem.create({
        detail: "Informe uma habilitação para uma sugestão de habilitação.",
        fields: [
            {
                code: "REQUIRED",
                path: ["specializationId"],
                message:
                    "Informe uma habilitação para uma sugestão de habilitação."
            }
        ]
    });
}

export function specializationNotAllowedForSuggestionProblem() {
    return SpecializationNotAllowedForSuggestionProblem.create({
        detail: "Este tipo de sugestão não permite uma habilitação.",
        fields: [
            {
                code: "INVALID_VALUE",
                path: ["specializationId"],
                message:
                    "A habilitação só pode ser informada para sugestões de habilitação."
            }
        ]
    });
}

export function specializationNotAvailableInCatalogProgramProblem() {
    return SpecializationNotAvailableInCatalogProgramProblem.create({
        detail: "A habilitação informada não está disponível neste programa de catálogo.",
        fields: [
            {
                code: "NOT_AVAILABLE",
                path: ["specializationId"],
                message:
                    "A habilitação informada não está disponível neste programa de catálogo."
            }
        ]
    });
}

export type CurriculumSuggestionProblem =
    | ReturnType<typeof curriculumSuggestionNotFoundProblem>
    | ReturnType<typeof curriculumSuggestionReferenceNotFoundProblem>
    | ReturnType<typeof curriculumSuggestionAlreadyExistsProblem>
    | ReturnType<typeof specializationRequiredForSuggestionProblem>
    | ReturnType<typeof specializationNotAllowedForSuggestionProblem>
    | ReturnType<typeof specializationNotAvailableInCatalogProgramProblem>;

function prefixFields<Problem extends { fields: ProblemField[] }>(
    problem: Problem,
    context: ProblemResponseContext
): Problem {
    return prefixProblemFields(problem, context.inputLocation);
}

export const curriculumSuggestionProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        prefixFields
    ),
    [UniqueConstraintConflictProblem.type]: problemResponse(
        UniqueConstraintConflictProblem,
        prefixFields
    ),
    [SpecializationRequiredForSuggestionProblem.type]: problemResponse(
        SpecializationRequiredForSuggestionProblem,
        prefixFields
    ),
    [SpecializationNotAllowedForSuggestionProblem.type]: problemResponse(
        SpecializationNotAllowedForSuggestionProblem,
        prefixFields
    ),
    [SpecializationNotAvailableInCatalogProgramProblem.type]: problemResponse(
        SpecializationNotAvailableInCatalogProgramProblem,
        prefixFields
    )
} satisfies ProblemResponseMap<
    CurriculumSuggestionProblem,
    ProblemResponseContext
>;
