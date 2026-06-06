import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/LanguageInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

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
