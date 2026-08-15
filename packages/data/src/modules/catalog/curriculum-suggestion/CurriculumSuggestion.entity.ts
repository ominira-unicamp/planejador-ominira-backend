import { curriculumSuggestionDataSchema } from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaCurriculumSuggestionFieldSelection = {
    include: {
        catalogProgram: {
            include: {
                catalog: {
                    select: {
                        year: true
                    }
                },
                program: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                }
            }
        },
        catalogSpecialization: {
            include: {
                specialization: {
                    select: { id: true, code: true, name: true }
                }
            }
        },
        semesters: {
            include: {
                courses: {
                    include: {
                        course: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                credits: true
                            }
                        }
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.CurriculumSuggestionDefaultArgs;

type PrismaCurriculumSuggestionPayload =
    MyPrisma.CurriculumSuggestionGetPayload<
        typeof prismaCurriculumSuggestionFieldSelection
    >;

export function buildCurriculumSuggestionEntity(
    suggestion: PrismaCurriculumSuggestionPayload
): z.infer<typeof curriculumSuggestionDataSchema> {
    return {
        id: suggestion.id,
        catalogProgramId: suggestion.catalogProgramId,
        catalogYear: suggestion.catalogProgram.catalog.year,
        programId: suggestion.catalogProgram.program.id,
        programCode: suggestion.catalogProgram.program.code,
        programName: suggestion.catalogProgram.program.name,
        code: suggestion.code,
        name: suggestion.name,
        type: suggestion.type,
        specialization:
            suggestion.catalogSpecialization?.specialization ?? null,
        semesters: suggestion.semesters
            .map((semester) => ({
                semester: semester.semester,
                electiveCredits: semester.electiveCredits,
                courses: semester.courses
                    .map(({ course }) => ({
                        id: course.id,
                        code: course.code,
                        name: course.name,
                        credits: course.credits
                    }))
                    .sort((left, right) => left.code.localeCompare(right.code))
            }))
            .sort((left, right) => left.semester - right.semester)
    };
}

export default {
    build: buildCurriculumSuggestionEntity,
    prismaSelection: prismaCurriculumSuggestionFieldSelection
};
