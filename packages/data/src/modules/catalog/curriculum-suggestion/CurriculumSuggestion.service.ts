import {
    curriculumSuggestionDataSchema,
    type CurriculumSuggestionFilter,
    type CurriculumSuggestionFilterName,
    type ListCurriculumSuggestionsQuery
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.contract.js";
import curriculumSuggestionEntity from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.entity.js";
import { curriculumSuggestionNotFoundProblem } from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.problems.js";
import {
    compileFilterWhere,
    containsAt,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CurriculumSuggestionData = z.infer<typeof curriculumSuggestionDataSchema>;

const curriculumSuggestionWhere =
    prismaWhereFor<MyPrisma.CurriculumSuggestionWhereInput>();
const curriculumSuggestionWhereDefinitions = {
    catalogProgramId: curriculumSuggestionWhere.numberAt("catalogProgramId"),
    catalogId: curriculumSuggestionWhere.numberAt("catalogProgram.catalogId"),
    catalogYear: curriculumSuggestionWhere.numberAt(
        "catalogProgram.catalog.year"
    ),
    programId: curriculumSuggestionWhere.numberAt("catalogProgram.programId"),
    programCode: curriculumSuggestionWhere.numberAt(
        "catalogProgram.program.code"
    ),
    code: containsAt<MyPrisma.CurriculumSuggestionWhereInput>("code"),
    type: curriculumSuggestionWhere.enumAt("type"),
    specializationId: curriculumSuggestionWhere.numberAt(
        "catalogSpecialization.specializationId"
    )
} satisfies Record<
    CurriculumSuggestionFilterName,
    FilterWhereBuilder<MyPrisma.CurriculumSuggestionWhereInput>
>;

export function curriculumSuggestionFilterWhere(
    filter: CurriculumSuggestionFilter | undefined
): MyPrisma.CurriculumSuggestionWhereInput[] {
    return compileFilterWhere(
        filter,
        curriculumSuggestionWhereDefinitions,
        "curriculum suggestion"
    );
}

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
            const filterWhere = curriculumSuggestionFilterWhere(input.filter);
            const suggestions = await prisma.curriculumSuggestion.findMany({
                ...curriculumSuggestionEntity.prismaSelection,
                where: filterWhere.length > 0 ? { AND: filterWhere } : {}
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
