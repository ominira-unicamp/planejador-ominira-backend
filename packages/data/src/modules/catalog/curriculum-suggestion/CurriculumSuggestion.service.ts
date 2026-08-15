import {
    curriculumSuggestionDataSchema,
    type ListCurriculumSuggestionsQuery
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.contract.js";
import curriculumSuggestionEntity from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.entity.js";
import { curriculumSuggestionNotFoundProblem } from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type CurriculumSuggestionData = z.infer<typeof curriculumSuggestionDataSchema>;

export type CurriculumSuggestionService = {
    list(
        input: ListCurriculumSuggestionsQuery
    ): Promise<CurriculumSuggestionData[]>;
    getById(
        id: number
    ): Promise<
        Result<
            CurriculumSuggestionData,
            ReturnType<typeof curriculumSuggestionNotFoundProblem>
        >
    >;
};

export function createCurriculumSuggestionService({
    prisma
}: {
    prisma: PrismaClient;
}): CurriculumSuggestionService {
    return {
        async list(input) {
            const hasCatalogProgramFilter =
                input.catalogId !== undefined ||
                input.catalogYear !== undefined ||
                input.programId !== undefined ||
                input.programCode !== undefined;
            const suggestions = await prisma.curriculumSuggestion.findMany({
                ...curriculumSuggestionEntity.prismaSelection,
                where: {
                    ...(input.catalogProgramId !== undefined
                        ? { catalogProgramId: input.catalogProgramId }
                        : {}),
                    ...(input.code !== undefined
                        ? { code: { equals: input.code, mode: "insensitive" } }
                        : {}),
                    ...(input.type !== undefined ? { type: input.type } : {}),
                    ...(input.specializationId !== undefined
                        ? {
                              catalogSpecialization: {
                                  specializationId: input.specializationId
                              }
                          }
                        : {}),
                    ...(hasCatalogProgramFilter
                        ? {
                              catalogProgram: {
                                  ...(input.catalogId !== undefined
                                      ? { catalogId: input.catalogId }
                                      : {}),
                                  ...(input.programId !== undefined
                                      ? { programId: input.programId }
                                      : {}),
                                  ...(input.catalogYear !== undefined
                                      ? { catalog: { year: input.catalogYear } }
                                      : {}),
                                  ...(input.programCode !== undefined
                                      ? { program: { code: input.programCode } }
                                      : {})
                              }
                          }
                        : {})
                }
            });
            return suggestions
                .map(curriculumSuggestionEntity.build)
                .sort(
                    (left, right) =>
                        right.catalogYear - left.catalogYear ||
                        left.programCode - right.programCode ||
                        left.code.localeCompare(right.code)
                );
        },
        async getById(id) {
            const suggestion = await prisma.curriculumSuggestion.findUnique({
                ...curriculumSuggestionEntity.prismaSelection,
                where: { id }
            });
            return suggestion
                ? ok(curriculumSuggestionEntity.build(suggestion))
                : err(curriculumSuggestionNotFoundProblem());
        }
    };
}
