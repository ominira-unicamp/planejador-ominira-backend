import {
    curriculumSuggestionDataSchema,
    type CreateCurriculumSuggestionBody,
    type ListCurriculumSuggestionsQuery,
    type PatchCurriculumSuggestionBody
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.contract.js";
import curriculumSuggestionEntity from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.entity.js";
import {
    curriculumSuggestionAlreadyExistsProblem,
    curriculumSuggestionNotFoundProblem,
    curriculumSuggestionReferenceNotFoundProblem,
    specializationNotAllowedForSuggestionProblem,
    specializationNotAvailableInCatalogProgramProblem,
    specializationRequiredForSuggestionProblem
} from "#/modules/catalog/curriculum-suggestion/CurriculumSuggestion.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import { CurriculumSuggestionType, type PrismaClient } from "@pomi/db";
import z from "zod";

type CurriculumSuggestionData = z.infer<typeof curriculumSuggestionDataSchema>;
type SemestersInput = CreateCurriculumSuggestionBody["semesters"];
type ProblemField = { code: string; path: string[]; message: string };
type SpecializationValidation =
    | {
          catalogSpecializationId: number | null;
      }
    | {
          error: ReturnType<
              | typeof curriculumSuggestionReferenceNotFoundProblem
              | typeof specializationNotAllowedForSuggestionProblem
              | typeof specializationNotAvailableInCatalogProgramProblem
              | typeof specializationRequiredForSuggestionProblem
          >;
      };

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
    create(
        input: CreateCurriculumSuggestionBody
    ): Promise<
        Result<
            CurriculumSuggestionData,
            | ReturnType<typeof curriculumSuggestionReferenceNotFoundProblem>
            | ReturnType<typeof curriculumSuggestionAlreadyExistsProblem>
            | ReturnType<typeof specializationNotAllowedForSuggestionProblem>
            | ReturnType<
                  typeof specializationNotAvailableInCatalogProgramProblem
              >
            | ReturnType<typeof specializationRequiredForSuggestionProblem>
        >
    >;
    patch(
        id: number,
        input: PatchCurriculumSuggestionBody
    ): Promise<
        Result<
            CurriculumSuggestionData,
            | ReturnType<typeof curriculumSuggestionNotFoundProblem>
            | ReturnType<typeof curriculumSuggestionAlreadyExistsProblem>
            | ReturnType<typeof curriculumSuggestionReferenceNotFoundProblem>
            | ReturnType<typeof specializationNotAllowedForSuggestionProblem>
            | ReturnType<
                  typeof specializationNotAvailableInCatalogProgramProblem
              >
            | ReturnType<typeof specializationRequiredForSuggestionProblem>
        >
    >;
    remove(
        id: number
    ): Promise<
        Result<void, ReturnType<typeof curriculumSuggestionNotFoundProblem>>
    >;
};

function nestedSemesters(semesters: SemestersInput) {
    return semesters.map((semester) => ({
        semester: semester.semester,
        electiveCredits: semester.electiveCredits,
        courses: {
            create: semester.courses.map(({ courseId }) => ({ courseId }))
        }
    }));
}

function courseInputs(semesters: SemestersInput) {
    return semesters.flatMap((semester, semesterIndex) =>
        semester.courses.map((course, courseIndex) => ({
            courseId: course.courseId,
            path: [
                "semesters",
                String(semesterIndex),
                "courses",
                String(courseIndex),
                "courseId"
            ]
        }))
    );
}

async function missingCourseFields(
    prisma: PrismaClient,
    semesters: SemestersInput
) {
    const inputs = courseInputs(semesters);
    if (inputs.length === 0) return [];

    const courses = await prisma.course.findMany({
        where: { id: { in: inputs.map(({ courseId }) => courseId) } },
        select: { id: true }
    });
    const persistedIds = new Set(courses.map(({ id }) => id));
    return inputs
        .filter(({ courseId }) => !persistedIds.has(courseId))
        .map<ProblemField>(({ path }) => ({
            code: "REFERENCE_NOT_FOUND",
            path,
            message: "A disciplina informada não foi encontrada."
        }));
}

async function specializationValidation(
    prisma: PrismaClient,
    catalogProgramId: number,
    type: CurriculumSuggestionType,
    specializationId: number | null | undefined
): Promise<SpecializationValidation> {
    if (type !== CurriculumSuggestionType.SPECIALIZATION) {
        if (specializationId != null) {
            return {
                error: specializationNotAllowedForSuggestionProblem()
            };
        }
        return { catalogSpecializationId: null };
    }

    if (specializationId == null) {
        return {
            error: specializationRequiredForSuggestionProblem()
        };
    }

    const specialization = await prisma.specialization.findUnique({
        where: { id: specializationId },
        select: { id: true }
    });
    if (!specialization) {
        return {
            error: curriculumSuggestionReferenceNotFoundProblem(
                [
                    {
                        code: "REFERENCE_NOT_FOUND",
                        path: ["specializationId"],
                        message: "A habilitação informada não foi encontrada."
                    }
                ],
                "A habilitação informada não foi encontrada."
            )
        };
    }

    const catalogSpecialization = await prisma.catalogSpecialization.findFirst({
        where: { catalogProgramId, specializationId },
        select: { id: true }
    });
    if (!catalogSpecialization) {
        return {
            error: specializationNotAvailableInCatalogProgramProblem()
        };
    }
    return { catalogSpecializationId: catalogSpecialization.id };
}

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
        },

        async create(input) {
            const catalogProgram = await prisma.catalogProgram.findUnique({
                where: { id: input.catalogProgramId },
                select: { id: true }
            });
            if (!catalogProgram) {
                return err(
                    curriculumSuggestionReferenceNotFoundProblem([
                        {
                            code: "REFERENCE_NOT_FOUND",
                            path: ["catalogProgramId"],
                            message:
                                "O programa de catálogo informado não foi encontrado."
                        }
                    ])
                );
            }

            const existing = await prisma.curriculumSuggestion.findUnique({
                where: {
                    catalogProgramId_code: {
                        catalogProgramId: input.catalogProgramId,
                        code: input.code
                    }
                },
                select: { id: true }
            });
            if (existing)
                return err(
                    curriculumSuggestionAlreadyExistsProblem(input.code)
                );

            const specialization = await specializationValidation(
                prisma,
                input.catalogProgramId,
                input.type,
                input.specializationId
            );
            if ("error" in specialization) return err(specialization.error);

            const missingCourses = await missingCourseFields(
                prisma,
                input.semesters
            );
            if (missingCourses.length > 0)
                return err(
                    curriculumSuggestionReferenceNotFoundProblem(
                        missingCourses,
                        "Uma ou mais disciplinas informadas não foram encontradas."
                    )
                );

            const suggestion = await prisma.$transaction((tx) =>
                tx.curriculumSuggestion.create({
                    ...curriculumSuggestionEntity.prismaSelection,
                    data: {
                        catalogProgramId: input.catalogProgramId,
                        code: input.code,
                        name: input.name,
                        type: input.type,
                        catalogSpecializationId:
                            specialization.catalogSpecializationId,
                        semesters: { create: nestedSemesters(input.semesters) }
                    }
                })
            );
            return ok(curriculumSuggestionEntity.build(suggestion));
        },

        async patch(id, input) {
            const current = await prisma.curriculumSuggestion.findUnique({
                where: { id },
                select: {
                    id: true,
                    catalogProgramId: true,
                    type: true,
                    catalogSpecialization: {
                        select: { specializationId: true }
                    }
                }
            });
            if (!current) return err(curriculumSuggestionNotFoundProblem());

            if (input.code !== undefined) {
                const duplicate = await prisma.curriculumSuggestion.findUnique({
                    where: {
                        catalogProgramId_code: {
                            catalogProgramId: current.catalogProgramId,
                            code: input.code
                        }
                    },
                    select: { id: true }
                });
                if (duplicate && duplicate.id !== id)
                    return err(
                        curriculumSuggestionAlreadyExistsProblem(input.code)
                    );
            }

            const type = input.type ?? current.type;
            const specializationId =
                input.specializationId !== undefined
                    ? input.specializationId
                    : current.catalogSpecialization?.specializationId;
            const specialization = await specializationValidation(
                prisma,
                current.catalogProgramId,
                type,
                specializationId
            );
            if ("error" in specialization) return err(specialization.error);

            if (input.semesters !== undefined) {
                const missingCourses = await missingCourseFields(
                    prisma,
                    input.semesters
                );
                if (missingCourses.length > 0)
                    return err(
                        curriculumSuggestionReferenceNotFoundProblem(
                            missingCourses,
                            "Uma ou mais disciplinas informadas não foram encontradas."
                        )
                    );
            }

            const suggestion = await prisma.$transaction((tx) =>
                tx.curriculumSuggestion.update({
                    ...curriculumSuggestionEntity.prismaSelection,
                    where: { id },
                    data: {
                        ...(input.code !== undefined
                            ? { code: input.code }
                            : {}),
                        ...(input.name !== undefined
                            ? { name: input.name }
                            : {}),
                        ...(input.type !== undefined
                            ? { type: input.type }
                            : {}),
                        ...(input.type !== undefined ||
                        input.specializationId !== undefined
                            ? {
                                  catalogSpecializationId:
                                      specialization.catalogSpecializationId
                              }
                            : {}),
                        ...(input.semesters !== undefined
                            ? {
                                  semesters: {
                                      deleteMany: {},
                                      create: nestedSemesters(input.semesters)
                                  }
                              }
                            : {})
                    }
                })
            );
            return ok(curriculumSuggestionEntity.build(suggestion));
        },

        async remove(id) {
            const deleted = await prisma.curriculumSuggestion.deleteMany({
                where: { id }
            });
            return deleted.count === 0
                ? err(curriculumSuggestionNotFoundProblem())
                : ok(undefined);
        }
    };
}
