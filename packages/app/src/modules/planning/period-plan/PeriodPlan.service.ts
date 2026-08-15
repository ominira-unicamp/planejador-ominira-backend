import IO, {
    createBody,
    guideSchema,
    patchBody
} from "#/modules/planning/period-plan/PeriodPlan.contract.js";
import periodPlanningEntity from "#/modules/planning/period-plan/PeriodPlan.entity.js";
import {
    periodPlanInputProblem,
    periodPlanNotFoundProblem,
    type PeriodPlanProblem
} from "#/modules/planning/period-plan/PeriodPlan.problems.js";
import { err, ok, type ProblemField, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type PeriodPlan = z.infer<typeof IO.schema>;
type GuideInput = z.infer<typeof guideSchema>;
export type CreatePeriodPlanInput = z.infer<typeof createBody>;
export type PatchPeriodPlanInput = z.infer<typeof patchBody>;

export type PeriodPlanService = {
    list(studentId: number): Promise<PeriodPlan[]>;
    getById(
        studentId: number,
        id: number
    ): Promise<
        Result<PeriodPlan, ReturnType<typeof periodPlanNotFoundProblem>>
    >;
    create(
        studentId: number,
        input: CreatePeriodPlanInput
    ): Promise<
        Result<
            PeriodPlan,
            Exclude<
                PeriodPlanProblem,
                ReturnType<typeof periodPlanNotFoundProblem>
            >
        >
    >;
    patch(
        studentId: number,
        id: number,
        input: PatchPeriodPlanInput
    ): Promise<Result<PeriodPlan, PeriodPlanProblem>>;
    remove(
        studentId: number,
        id: number
    ): Promise<Result<void, ReturnType<typeof periodPlanNotFoundProblem>>>;
};

function legacyGuide(curriculumId: number | null | undefined): GuideInput {
    return {
        mode: curriculumId == null ? "NONE" : "CURRICULUM",
        curriculumSource: curriculumId == null ? null : "SAVED",
        curriculumId: curriculumId ?? null,
        suggestionId: null,
        suggestionCatalogProgramId: null,
        catalogProgramId: null,
        specializationId: null,
        languageId: null,
        manualCourseIds: []
    };
}

async function guideFields(
    prisma: PrismaClient,
    guide: GuideInput,
    studentId: number
): Promise<ProblemField[]> {
    const fields: ProblemField[] = [];
    if (guide.curriculumSource === "SAVED") {
        const curriculum =
            guide.curriculumId === null
                ? null
                : await prisma.curriculum.findFirst({
                      where: { id: guide.curriculumId, studentId },
                      select: { id: true }
                  });
        if (guide.curriculumId !== null && !curriculum)
            fields.push({
                path: ["guide", "curriculumId"],
                code: "REFERENCE_NOT_FOUND",
                message: "O currículo salvo não pertence a este estudante."
            });
        if (guide.suggestionId !== null)
            fields.push({
                path: ["guide", "suggestionId"],
                code: "INVALID_VALUE",
                message: "Um currículo salvo não pode selecionar uma sugestão."
            });
    }
    if (guide.curriculumSource === "SUGGESTION") {
        const suggestion =
            guide.suggestionId === null
                ? null
                : await prisma.curriculumSuggestion.findUnique({
                      where: { id: guide.suggestionId },
                      select: { id: true }
                  });
        if (guide.suggestionId !== null && !suggestion)
            fields.push({
                path: ["guide", "suggestionId"],
                code: "REFERENCE_NOT_FOUND",
                message: "A sugestão curricular não foi encontrada."
            });
        if (guide.curriculumId !== null)
            fields.push({
                path: ["guide", "curriculumId"],
                code: "INVALID_VALUE",
                message: "Uma sugestão não pode selecionar um currículo salvo."
            });
    }
    if (
        guide.curriculumSource === null &&
        (guide.curriculumId !== null || guide.suggestionId !== null)
    )
        fields.push({
            path: ["guide", "curriculumSource"],
            code: "INVALID_VALUE",
            message:
                "A origem é obrigatória quando há uma referência curricular."
        });

    const [program, specialization, language] = await Promise.all([
        guide.catalogProgramId === null
            ? null
            : prisma.catalogProgram.findUnique({
                  where: { id: guide.catalogProgramId },
                  select: { id: true }
              }),
        guide.specializationId === null
            ? null
            : prisma.catalogSpecialization.findFirst({
                  where: {
                      specializationId: guide.specializationId,
                      ...(guide.catalogProgramId === null
                          ? {}
                          : { catalogProgramId: guide.catalogProgramId })
                  },
                  select: { specializationId: true }
              }),
        guide.languageId === null
            ? null
            : prisma.catalogLanguage.findFirst({
                  where: {
                      languageId: guide.languageId,
                      ...(guide.catalogProgramId === null
                          ? {}
                          : { catalogProgramId: guide.catalogProgramId })
                  },
                  select: { languageId: true }
              })
    ]);
    if (guide.catalogProgramId !== null && !program)
        fields.push({
            path: ["guide", "catalogProgramId"],
            code: "REFERENCE_NOT_FOUND",
            message: "O programa de catálogo não foi encontrado."
        });
    if (guide.specializationId !== null && !specialization)
        fields.push({
            path: ["guide", "specializationId"],
            code: "REFERENCE_NOT_FOUND",
            message: "A habilitação não está disponível para o programa."
        });
    if (guide.languageId !== null && !language)
        fields.push({
            path: ["guide", "languageId"],
            code: "REFERENCE_NOT_FOUND",
            message: "A língua não está disponível para o programa."
        });

    const courseIds = [...new Set(guide.manualCourseIds)];
    if (courseIds.length) {
        const courses = await prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true }
        });
        const found = new Set(courses.map(({ id }) => id));
        for (const id of courseIds)
            if (!found.has(id))
                fields.push({
                    path: ["guide", "manualCourseIds", String(id)],
                    code: "REFERENCE_NOT_FOUND",
                    message: `A disciplina ${id} não foi encontrada.`
                });
    }
    return fields;
}

async function classFields(
    prisma: PrismaClient,
    classIds: Set<number>,
    studyPeriodId: number,
    path: string[]
): Promise<ProblemField[]> {
    if (!classIds.size) return [];
    const classes = await prisma.class.findMany({
        where: { id: { in: [...classIds] } },
        select: { id: true, courseId: true, studyPeriodId: true }
    });
    const byId = new Map(classes.map((item) => [item.id, item]));
    const fields: ProblemField[] = [];
    for (const id of classIds) {
        const classEntity = byId.get(id);
        if (!classEntity)
            fields.push({
                code: "REFERENCE_NOT_FOUND",
                path: [...path, String(id)],
                message: `A turma ${id} não foi encontrada.`
            });
        else if (classEntity.studyPeriodId !== studyPeriodId)
            fields.push({
                code: "INVALID_VALUE",
                path: [...path, String(id)],
                message: `A turma ${id} pertence a outro período letivo.`
            });
    }
    const firstClassByCourse = new Map<number, number>();
    for (const classEntity of classes) {
        const firstId = firstClassByCourse.get(classEntity.courseId);
        if (firstId === undefined)
            firstClassByCourse.set(classEntity.courseId, classEntity.id);
        else
            fields.push({
                code: "INVALID_VALUE",
                path: [...path, String(classEntity.id)],
                message: `As turmas ${firstId} e ${classEntity.id} são da mesma disciplina.`
            });
    }
    return fields;
}

function classUpdateData(
    operations: NonNullable<PatchPeriodPlanInput["classes"]>
) {
    if (operations.set)
        return { set: [...operations.set].map((id) => ({ id })) };
    return {
        disconnect: operations.remove
            ? [...operations.remove].map((id) => ({ id }))
            : undefined,
        connect: operations.add
            ? [...operations.add].map((id) => ({ id }))
            : undefined
    };
}

function guideUpdateData(guide: GuideInput) {
    return {
        guideMode: guide.mode,
        curriculumSource: guide.curriculumSource,
        curriculum:
            guide.curriculumId === null
                ? { disconnect: true }
                : { connect: { id: guide.curriculumId } },
        curriculumSuggestion:
            guide.suggestionId === null
                ? { disconnect: true }
                : { connect: { id: guide.suggestionId } },
        catalogProgram:
            guide.catalogProgramId === null
                ? { disconnect: true }
                : { connect: { id: guide.catalogProgramId } },
        specialization:
            guide.specializationId === null
                ? { disconnect: true }
                : { connect: { id: guide.specializationId } },
        language:
            guide.languageId === null
                ? { disconnect: true }
                : { connect: { id: guide.languageId } },
        manualCourses: {
            deleteMany: {},
            create: guide.manualCourseIds.map((courseId) => ({
                course: { connect: { id: courseId } }
            }))
        }
    };
}

function load(prisma: PrismaClient, studentId: number, id: number) {
    return prisma.periodPlanning.findUnique({
        ...periodPlanningEntity.prismaSelection,
        where: { studentId, id }
    });
}

export function createPeriodPlanService({
    prisma
}: {
    prisma: PrismaClient;
}): PeriodPlanService {
    return {
        async list(studentId) {
            return (
                await prisma.periodPlanning.findMany({
                    ...periodPlanningEntity.prismaSelection,
                    where: { studentId },
                    orderBy: { updatedAt: "desc" }
                })
            ).map(periodPlanningEntity.build);
        },
        async getById(studentId, id) {
            const periodPlan = await load(prisma, studentId, id);
            return periodPlan
                ? ok(periodPlanningEntity.build(periodPlan))
                : err(periodPlanNotFoundProblem());
        },
        async create(studentId, input) {
            const guide = input.guide ?? legacyGuide(input.curriculumId);
            const studyPeriod = await prisma.studyPeriod.findUnique({
                where: { id: input.studyPeriodId },
                select: { id: true, code: true }
            });
            const fields: ProblemField[] = studyPeriod
                ? []
                : [
                      {
                          path: ["studyPeriodId"],
                          code: "REFERENCE_NOT_FOUND",
                          message: "O período letivo não foi encontrado."
                      }
                  ];
            fields.push(
                ...(await classFields(
                    prisma,
                    input.classes,
                    input.studyPeriodId,
                    ["classes"]
                )),
                ...(await guideFields(prisma, guide, studentId))
            );
            if (fields.length) return err(periodPlanInputProblem(fields));
            const periodPlan = await prisma.periodPlanning.create({
                ...periodPlanningEntity.prismaSelection,
                data: {
                    student: { connect: { id: studentId } },
                    studyPeriod: { connect: { id: input.studyPeriodId } },
                    name:
                        input.name ?? `Planejamento ${studyPeriod?.code ?? ""}`,
                    guideMode: guide.mode,
                    curriculumSource: guide.curriculumSource,
                    ...(guide.curriculumId === null
                        ? {}
                        : {
                              curriculum: {
                                  connect: { id: guide.curriculumId }
                              }
                          }),
                    ...(guide.suggestionId === null
                        ? {}
                        : {
                              curriculumSuggestion: {
                                  connect: { id: guide.suggestionId }
                              }
                          }),
                    ...(guide.catalogProgramId === null
                        ? {}
                        : {
                              catalogProgram: {
                                  connect: { id: guide.catalogProgramId }
                              }
                          }),
                    ...(guide.specializationId === null
                        ? {}
                        : {
                              specialization: {
                                  connect: { id: guide.specializationId }
                              }
                          }),
                    ...(guide.languageId === null
                        ? {}
                        : { language: { connect: { id: guide.languageId } } }),
                    manualCourses: {
                        create: guide.manualCourseIds.map((courseId) => ({
                            course: { connect: { id: courseId } }
                        }))
                    },
                    classes: {
                        connect: [...input.classes].map((id) => ({ id }))
                    }
                }
            });
            return ok(periodPlanningEntity.build(periodPlan));
        },
        async patch(studentId, id, input) {
            const existing = await load(prisma, studentId, id);
            if (!existing) return err(periodPlanNotFoundProblem());
            const guide =
                input.guide !== undefined
                    ? input.guide
                    : input.curriculumId !== undefined
                      ? legacyGuide(input.curriculumId)
                      : undefined;
            const fields = guide
                ? await guideFields(prisma, guide, studentId)
                : [];
            if (input.classes) {
                const ids = input.classes.set
                    ? new Set(input.classes.set)
                    : new Set([
                          ...existing.classes
                              .map(({ id: classId }) => classId)
                              .filter(
                                  (classId) =>
                                      !input.classes?.remove?.has(classId)
                              ),
                          ...(input.classes.add ?? [])
                      ]);
                fields.push(
                    ...(await classFields(prisma, ids, existing.studyPeriodId, [
                        "classes",
                        input.classes.set ? "set" : "add"
                    ]))
                );
            }
            if (fields.length) return err(periodPlanInputProblem(fields));
            const periodPlan = await prisma.periodPlanning.update({
                ...periodPlanningEntity.prismaSelection,
                where: { id },
                data: {
                    ...(input.name !== undefined && { name: input.name }),
                    ...(guide ? guideUpdateData(guide) : {}),
                    ...(input.classes
                        ? { classes: classUpdateData(input.classes) }
                        : {})
                }
            });
            return ok(periodPlanningEntity.build(periodPlan));
        },
        async remove(studentId, id) {
            const existing = await prisma.periodPlanning.findUnique({
                where: { studentId, id },
                select: { id: true }
            });
            if (!existing) return err(periodPlanNotFoundProblem());
            await prisma.periodPlanning.delete({ where: { id } });
            return ok(undefined);
        }
    };
}
