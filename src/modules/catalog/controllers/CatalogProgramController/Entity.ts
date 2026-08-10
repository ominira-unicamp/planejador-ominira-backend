import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/catalog/contracts/CatalogProgramInterface.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { CourseBlockType } from "../../../../../prisma/generated/client.js";

extendZodWithOpenApi(z);

export const prismaBlockSetSelection = {
    include: {
        courseRequirements: {
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                },
                prefix: {
                    select: {
                        id: true,
                        prefix: true
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.CourseBlockDefaultArgs;

export const prismaCatalogProgramFieldSelection = {
    include: {
        catalog: {
            select: {
                id: true,
                year: true
            }
        },
        program: {
            select: {
                id: true,
                code: true,
                name: true
            }
        },
        catalogSpecializations: {
            include: {
                curriculumSuggestion: { select: { id: true } },
                specialization: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                },
                courseBlocks: prismaBlockSetSelection
            }
        },
        catalogLanguages: {
            include: {
                language: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                courseBlocks: prismaBlockSetSelection
            }
        },
        courseBlocks: prismaBlockSetSelection
    }
} as const satisfies MyPrisma.CatalogProgramDefaultArgs;

type PrismaCatalogProgramPayload = MyPrisma.CatalogProgramGetPayload<
    typeof prismaCatalogProgramFieldSelection
>;

function relatedPathsForCatalogProgram(
    catalogProgramId: number,
    catalogId: number,
    programId: number
) {
    return {
        self: `/catalog-program/${catalogProgramId}`,
        catalog: `/catalogs/${catalogId}`,
        program: `/programs/${programId}`,
        curriculumSuggestions: `/curriculum-suggestions?catalogProgramId=${catalogProgramId}`
    };
}

function transformCourseBlocks(
    courseBlocks: PrismaCatalogProgramPayload["courseBlocks"]
): z.infer<typeof IO.schemas.courseBlockSetSchema> {
    const mandatory: z.infer<typeof IO.schemas.courseRequirementSchema>[] = [];
    const electives: z.infer<typeof IO.schemas.electiveBlockSchema>[] = [];

    const mandatoryBlocks = courseBlocks.filter(
        (block) => block.type === CourseBlockType.mandatory
    );
    const electiveBlocks = courseBlocks.filter(
        (block) => block.type === CourseBlockType.elective
    );

    for (const block of mandatoryBlocks) {
        for (const req of block.courseRequirements) {
            mandatory.push({
                id: req.id,
                type: req.type,
                courseId: req.courseId,
                courseCode: req.course?.code ?? null,
                courseName: req.course?.name ?? null,
                prefixId: req.prefixId,
                prefix: req.prefix?.prefix ?? null
            });
        }
    }

    for (const block of electiveBlocks) {
        const courses = block.courseRequirements.map((req) => ({
            id: req.id,
            type: req.type,
            courseId: req.courseId,
            courseCode: req.course?.code ?? null,
            courseName: req.course?.name ?? null,
            prefixId: req.prefixId,
            prefix: req.prefix?.prefix ?? null
        }));

        electives.push({
            credits: block.credits ?? 0,
            courses
        });
    }

    return { mandatory, electives };
}

function buildCatalogProgramEntity(
    catalogProgram: PrismaCatalogProgramPayload
): z.infer<typeof IO.schemas.catalogProgramEntity> {
    const { catalogSpecializations, catalogLanguages, courseBlocks, ...rest } =
        catalogProgram;

    const base = transformCourseBlocks(courseBlocks);

    const modalities = catalogSpecializations.map((spec) => ({
        specializationId: spec.specializationId,
        curriculumSuggestionId: spec.curriculumSuggestion?.id ?? null,
        code: spec.specialization.code,
        name: spec.specialization.name,
        blocks: transformCourseBlocks(spec.courseBlocks)
    }));

    const languages = catalogLanguages.map((lang) => ({
        languageId: lang.languageId,
        name: lang.language.name,
        blocks: transformCourseBlocks(lang.courseBlocks)
    }));

    return {
        ...rest,
        title: catalogProgram.program.name,
        catalogYear: catalogProgram.catalog.year,
        programCode: catalogProgram.program.code,
        programName: catalogProgram.program.name,
        base,
        modalities,
        languages,
        _paths: relatedPathsForCatalogProgram(
            rest.id,
            rest.catalogId,
            rest.programId
        )
    };
}

export default {
    build: buildCatalogProgramEntity,
    prismaSelection: prismaCatalogProgramFieldSelection
};
