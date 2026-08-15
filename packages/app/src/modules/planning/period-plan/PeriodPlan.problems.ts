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

export const InvalidPeriodPlanProblem = defineProblem({
    schemaName: "InvalidPeriodPlanProblem",
    typeName: "invalid-period-plan",
    title: "Planejamento de semestre inválido",
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

export const periodPlanNotFoundProblem = () =>
    ResourceNotFoundProblem.create({
        detail: "O planejamento de semestre solicitado não foi encontrado."
    });

export const periodPlanInputProblem = (fields: ProblemField[]) =>
    fields.some(({ code }) => code === "REFERENCE_NOT_FOUND")
        ? ReferenceNotFoundProblem.create({
              detail: "Uma ou mais referências do planejamento não foram encontradas.",
              fields
          })
        : InvalidPeriodPlanProblem.create({
              detail: "As informações do planejamento de semestre são incompatíveis.",
              fields
          });

export type PeriodPlanProblem =
    | ReturnType<typeof periodPlanNotFoundProblem>
    | ReturnType<typeof periodPlanInputProblem>;

export const periodPlanProblemResponses = {
    [ResourceNotFoundProblem.type]: problemResponse(ResourceNotFoundProblem),
    [ReferenceNotFoundProblem.type]: problemResponse(
        ReferenceNotFoundProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    ),
    [InvalidPeriodPlanProblem.type]: problemResponse(
        InvalidPeriodPlanProblem,
        (problem, context: ProblemResponseContext) =>
            prefixProblemFields(problem, context.inputLocation)
    )
} satisfies ProblemResponseMap<PeriodPlanProblem, ProblemResponseContext>;
