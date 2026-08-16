import IO from "#/modules/catalog/language/Language.contract.js";
import languageEntity from "#/modules/catalog/language/Language.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Language = z.infer<typeof IO.schema>;
export type LanguageService = {
    list(): Promise<Language[]>;
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
        async list() {
            return (
                await prisma.language.findMany({
                    ...languageEntity.prismaSelection,
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
