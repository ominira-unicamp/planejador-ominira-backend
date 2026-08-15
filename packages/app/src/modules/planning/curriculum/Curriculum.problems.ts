import {
    ReferenceNotFoundProblem,
    ResourceNotFoundProblem,
    defineProblem,
    prefixProblemFields,
    problemResponse,
    type ProblemField,
    type ProblemResponseContext,
    type ProblemResponseMap
} from "@pomi/api-core";
import z from "zod";

export const InvalidCurriculumProblem = defineProblem({
    schemaName: "InvalidCurriculumProblem",
    typeName: "invalid-curriculum",
    title: "Planejamento curricular inválido",
    status: 422,
    extensions: {
        fields: z.array(
            z.object({
                code: z.string(),
                path: z.array(z.string()),
                message: z.string()
            })
        )
    }
});

export const curriculumNotFoundProblem = () =>
    ResourceNotFoundProblem.create({
        detail: "O planejamento curricular solicitado não foi encontrado."
    });

export const curriculumInputProblem = (fields: ProblemField[]) =>
    fields.some(({ code }) => code === "REFERENCE_NOT_FOUND")
        ? ReferenceNotFoundProblem.create({
              detail: "Uma ou mais referências do planejamento não foram encontradas.",
              fields
          })
        : InvalidCurriculumProblem.create({
              detail: "As informações do planejamento curricular são incompatíveis.",
              fields
          });

export type CurriculumProblem =
    | ReturnType<typeof curriculumNotFoundProblem>
    | ReturnType<typeof curriculumInputProblem>;

export const curriculumProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [InvalidCurriculumProblem.type]: problemResponse(
        InvalidCurriculumProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    )
} satisfies ProblemResponseMap<CurriculumProblem, ProblemResponseContext>;
