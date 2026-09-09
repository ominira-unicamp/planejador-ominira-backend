import type {
    LanguageFilter,
    LanguageFilterName
} from "#/modules/catalog/language/Language.contract.js";
import IO from "#/modules/catalog/language/Language.contract.js";
import languageEntity from "#/modules/catalog/language/Language.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type Language = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const languageWhere = prismaWhereFor<MyPrisma.LanguageWhereInput>();
const languageWhereDefinitions = {
    id: languageWhere.numberAt("id"),
    name: languageWhere.containsAt("name")
} satisfies Record<
    LanguageFilterName,
    FilterWhereBuilder<MyPrisma.LanguageWhereInput>
>;
export function languageFilterWhere(
    filter: LanguageFilter | undefined
): MyPrisma.LanguageWhereInput[] {
    return compileFilterWhere(filter, languageWhereDefinitions, "language");
}
export type LanguageService = {
    list(query: Query): Promise<Language[]>;
    getById(
        id: number
    ): Promise<
        Result<Language, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createLanguageService({
    prisma
}: {
    prisma: PrismaClient;
}): LanguageService {
    return {
        async list(query) {
            const filterWhere = languageFilterWhere(query.filter);
            return (
                await prisma.language.findMany({
                    ...languageEntity.prismaSelection,
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                    orderBy: { name: "asc" }
                })
            ).map(languageEntity.build);
        },
        async getById(id) {
            const language = await prisma.language.findUnique({
                ...languageEntity.prismaSelection,
                where: { id }
            });
            return language
                ? ok(languageEntity.build(language))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Language not found"
                      })
                  );
        }
    };
}
