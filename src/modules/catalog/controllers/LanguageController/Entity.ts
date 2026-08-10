import { resourcesPaths } from "#/Controllers.js";
import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/catalog/contracts/LanguageInterface.js";
import z from "zod";

export const prismaLanguageFieldSelection = {
    include: {
        _count: {
            select: {
                catalogLanguages: true
            }
        }
    }
} as const satisfies MyPrisma.LanguageDefaultArgs;

type PrismaLanguagePayload = MyPrisma.LanguageGetPayload<
    typeof prismaLanguageFieldSelection
>;

function relatedPathsForLanguage(language: PrismaLanguagePayload) {
    return {
        self: resourcesPaths.language.entity(language.id)
    };
}

function buildLanguageEntity(
    language: PrismaLanguagePayload
): z.infer<typeof IO.schema> {
    const { _count, ...rest } = language;
    return {
        ...rest,
        catalogLanguagesCount: _count.catalogLanguages,
        _paths: relatedPathsForLanguage(language)
    };
}

export default {
    build: buildLanguageEntity,
    prismaSelection: prismaLanguageFieldSelection
};
