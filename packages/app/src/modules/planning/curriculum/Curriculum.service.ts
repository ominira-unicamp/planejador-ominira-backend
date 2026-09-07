import IO, {
    createBody,
    patchBody
} from "#/modules/planning/curriculum/Curriculum.contract.js";
import curriculumEntity from "#/modules/planning/curriculum/Curriculum.entity.js";
import {
    curriculumInputProblem,
    curriculumNotFoundProblem,
    type CurriculumProblem
} from "#/modules/planning/curriculum/Curriculum.problems.js";
import { err, ok, type ProblemField, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Curriculum = z.infer<typeof IO.schema>;
type CurriculumSummary = z.infer<typeof IO.summarySchema>;
export type CreateCurriculumInput = z.infer<typeof createBody>;
export type PatchCurriculumInput = z.infer<typeof patchBody>;
type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

class CurriculumOperationError extends Error {
    constructor(readonly fields: ProblemField[]) {
        super("Invalid curriculum operation");
    }
}

export type CurriculumService = {
    list(studentId: number): Promise<CurriculumSummary[]>;
    getById(
        studentId: number,
        id: number
    ): Promise<
        Result<Curriculum, ReturnType<typeof curriculumNotFoundProblem>>
    >;
    create(
        studentId: number,
        input: CreateCurriculumInput
    ): Promise<
        Result<
            Curriculum,
            Exclude<
                CurriculumProblem,
                ReturnType<typeof curriculumNotFoundProblem>
            >
        >
    >;
    patch(
        studentId: number,
        id: number,
        input: PatchCurriculumInput
    ): Promise<Result<Curriculum, CurriculumProblem>>;
    remove(
        studentId: number,
        id: number
    ): Promise<Result<void, ReturnType<typeof curriculumNotFoundProblem>>>;
};

function selectionData(selection: CreateCurriculumInput["selection"]) {
    return {
        catalogProgramId: selection?.catalogProgramId ?? null,
        specializationId: selection?.specializationId ?? null,
        languageId: selection?.languageId ?? null
    };
}

function patchSelectionData(
    selection: PatchCurriculumInput["selection"],
    existing: {
        catalogProgramId: number | null;
        catalogSpecialization: { specializationId: number } | null;
        catalogLanguage: { languageId: number } | null;
    }
) {
    const catalogProgramId =
        selection?.catalogProgramId !== undefined
            ? selection.catalogProgramId
            : existing.catalogProgramId;
    const programChanged =
        selection?.catalogProgramId !== undefined &&
        catalogProgramId !== existing.catalogProgramId;
    return selectionData({
        catalogProgramId,
        specializationId: programChanged
            ? null
            : selection?.specializationId !== undefined
              ? selection.specializationId
              : (existing.catalogSpecialization?.specializationId ?? null),
        languageId: programChanged
            ? null
            : selection?.languageId !== undefined
              ? selection.languageId
              : (existing.catalogLanguage?.languageId ?? null)
    });
}

async function resolveSelection(
    prisma: TransactionClient | PrismaClient,
    selection: ReturnType<typeof selectionData>
) {
    const [specialization, language] = await Promise.all([
        selection.specializationId === null ||
        selection.catalogProgramId === null
            ? null
            : prisma.catalogSpecialization.findFirst({
                  where: {
                      catalogProgramId: selection.catalogProgramId,
                      specializationId: selection.specializationId
                  },
                  select: { id: true }
              }),
        selection.languageId === null || selection.catalogProgramId === null
            ? null
            : prisma.catalogLanguage.findFirst({
                  where: {
                      catalogProgramId: selection.catalogProgramId,
                      languageId: selection.languageId
                  },
                  select: { id: true }
              })
    ]);
    return {
        catalogProgramId: selection.catalogProgramId,
        catalogSpecializationId: specialization?.id ?? null,
        catalogLanguageId: language?.id ?? null
    };
}

function planningStartData(
    planningStart: CreateCurriculumInput["planningStart"] | undefined
) {
    return planningStart
        ? {
              planningStartYear: planningStart.year,
              planningStartSemester: planningStart.semester,
              planningStartNumber: planningStart.semesterNumber
          }
        : {
              planningStartYear: null,
              planningStartSemester: null,
              planningStartNumber: null
          };
}

async function selectionFields(
    prisma: TransactionClient,
    selection: ReturnType<typeof selectionData>,
    resolved: {
        catalogSpecializationId: number | null;
        catalogLanguageId: number | null;
    }
): Promise<ProblemField[]> {
    const fields: ProblemField[] = [];
    const [program, specialization, language] = await Promise.all([
        selection.catalogProgramId === null
            ? null
            : prisma.catalogProgram.findUnique({
                  where: { id: selection.catalogProgramId },
                  select: { id: true }
              }),
        selection.specializationId === null ||
        selection.catalogProgramId === null
            ? null
            : prisma.catalogSpecialization.findFirst({
                  where: {
                      id: resolved.catalogSpecializationId ?? -1,
                      catalogProgramId: selection.catalogProgramId
                  },
                  select: { catalogProgramId: true }
              }),
        selection.languageId === null || selection.catalogProgramId === null
            ? null
            : prisma.catalogLanguage.findFirst({
                  where: {
                      id: resolved.catalogLanguageId ?? -1,
                      catalogProgramId: selection.catalogProgramId
                  },
                  select: { catalogProgramId: true }
              })
    ]);
    if (selection.catalogProgramId !== null && !program)
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["selection", "catalogProgramId"],
            message: "O programa de catálogo informado não foi encontrado."
        });
    if (
        selection.specializationId !== null &&
        (!specialization ||
            specialization.catalogProgramId !== selection.catalogProgramId)
    )
        fields.push({
            code: specialization ? "INVALID_VALUE" : "REFERENCE_NOT_FOUND",
            path: ["selection", "specializationId"],
            message:
                "A habilitação não pertence ao programa de catálogo informado."
        });
    if (
        selection.languageId !== null &&
        (!language || language.catalogProgramId !== selection.catalogProgramId)
    )
        fields.push({
            code: language ? "INVALID_VALUE" : "REFERENCE_NOT_FOUND",
            path: ["selection", "languageId"],
            message: "A língua não pertence ao programa de catálogo informado."
        });
    return fields;
}

async function courseFields(
    prisma: TransactionClient,
    courseIds: number[],
    path: string[]
): Promise<ProblemField[]> {
    const ids = [...new Set(courseIds)];
    const found = new Set(
        (
            await prisma.course.findMany({
                where: { id: { in: ids } },
                select: { id: true }
            })
        ).map(({ id }) => id)
    );
    return ids
        .filter((id) => !found.has(id))
        .map((id) => ({
            code: "REFERENCE_NOT_FOUND",
            path: [...path, String(id)],
            message: `A disciplina ${id} não foi encontrada.`
        }));
}

async function load(prisma: PrismaClient, studentId: number, id: number) {
    return prisma.curriculum.findUnique({
        ...curriculumEntity.prismaSelection,
        where: { studentId, id }
    });
}

async function patchPeriods(
    tx: TransactionClient,
    curriculumId: number,
    operations: NonNullable<PatchCurriculumInput["periods"]>
): Promise<ProblemField[]> {
    const existing = await tx.curriculumPeriod.findMany({
        where: { curriculumId },
        select: { id: true, position: true }
    });
    const ids = new Set(existing.map(({ id }) => id));
    const fields: ProblemField[] = [];
    for (const [index, update] of (operations.update ?? []).entries())
        if (!ids.has(update.id))
            fields.push({
                code: "REFERENCE_NOT_FOUND",
                path: ["periods", "update", String(index), "id"],
                message: "O período não pertence ao planejamento."
            });
    for (const [index, id] of (operations.remove ?? []).entries())
        if (!ids.has(id))
            fields.push({
                code: "REFERENCE_NOT_FOUND",
                path: ["periods", "remove", String(index)],
                message: "O período não pertence ao planejamento."
            });
    if (fields.length) return fields;

    const removed = new Set(operations.remove ?? []);
    const positions = [
        ...existing
            .filter(({ id }) => !removed.has(id))
            .map(
                ({ id, position }) =>
                    operations.update?.find((item) => item.id === id)
                        ?.position ?? position
            ),
        ...(operations.add ?? []).map(({ position }) => position)
    ];
    if (new Set(positions).size !== positions.length)
        return [
            {
                code: "INVALID_VALUE",
                path: ["periods"],
                message: "As posições dos períodos devem ser únicas."
            }
        ];

    await tx.curriculumCourse.updateMany({
        where: { curriculumId, periodId: { in: [...removed] } },
        data: { periodId: null }
    });
    if (removed.size)
        await tx.curriculumPeriod.deleteMany({
            where: { curriculumId, id: { in: [...removed] } }
        });
    for (const update of operations.update ?? [])
        await tx.curriculumPeriod.update({
            where: { id: update.id },
            data: { position: -update.id }
        });
    for (const update of operations.update ?? [])
        await tx.curriculumPeriod.update({
            where: { id: update.id },
            data: { position: update.position }
        });
    if (operations.add?.length)
        await tx.curriculumPeriod.createMany({
            data: operations.add.map(({ position }) => ({
                curriculumId,
                position
            }))
        });
    return [];
}

async function patchCourses(
    tx: TransactionClient,
    curriculumId: number,
    operations: NonNullable<PatchCurriculumInput["courses"]>
): Promise<ProblemField[]> {
    const upserts = operations.upsert ?? [];
    const fields = await courseFields(
        tx,
        upserts.map(({ courseId }) => courseId),
        ["courses", "upsert"]
    );
    const periodIds = upserts.flatMap(({ periodId }) =>
        periodId === null ? [] : [periodId]
    );
    const validPeriods = await tx.curriculumPeriod.count({
        where: { curriculumId, id: { in: [...new Set(periodIds)] } }
    });
    if (validPeriods !== new Set(periodIds).size)
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["courses", "upsert"],
            message: "Todos os períodos devem pertencer ao planejamento."
        });
    if (fields.length) return fields;
    if (operations.remove?.length)
        await tx.curriculumCourse.deleteMany({
            where: { curriculumId, courseId: { in: operations.remove } }
        });
    for (const course of upserts)
        await tx.curriculumCourse.upsert({
            where: {
                curriculumId_courseId: {
                    curriculumId,
                    courseId: course.courseId
                }
            },
            create: { curriculumId, ...course },
            update: { periodId: course.periodId }
        });
    return [];
}

export function createCurriculumService({
    prisma
}: {
    prisma: PrismaClient;
}): CurriculumService {
    return {
        async list(studentId) {
            return (
                await prisma.curriculum.findMany({
                    ...curriculumEntity.prismaSummarySelection,
                    where: { studentId },
                    orderBy: { updatedAt: "desc" }
                })
            )
                .map(curriculumEntity.buildSummary)
                .sort(
                    (left, right) =>
                        Number(right.isFavorite) - Number(left.isFavorite)
                );
        },
        async getById(studentId, id) {
            const curriculum = await load(prisma, studentId, id);
            return curriculum
                ? ok(curriculumEntity.build(curriculum))
                : err(curriculumNotFoundProblem());
        },
        async create(studentId, input) {
            const requestedSelection = selectionData(input.selection);
            const selection = await resolveSelection(
                prisma,
                requestedSelection
            );
            const fields = [
                ...(await selectionFields(
                    prisma,
                    requestedSelection,
                    selection
                )),
                ...(await courseFields(
                    prisma,
                    (input.courses ?? []).map(({ courseId }) => courseId),
                    ["courses"]
                ))
            ];
            if (fields.length) return err(curriculumInputProblem(fields));
            const curriculum = await prisma.$transaction(async (tx) => {
                const created = await tx.curriculum.create({
                    data: {
                        studentId,
                        name: input.name ?? "Novo planejamento",
                        ...selection,
                        ...planningStartData(input.planningStart),
                        currentPeriodId: input.currentPeriodId ?? null,
                        periods: input.periods
                            ? { create: input.periods }
                            : undefined,
                        courses: input.courses?.length
                            ? { create: input.courses }
                            : undefined
                    },
                    select: { id: true }
                });
                return tx.curriculum.findUniqueOrThrow({
                    ...curriculumEntity.prismaSelection,
                    where: { id: created.id }
                });
            });
            return ok(curriculumEntity.build(curriculum));
        },
        async patch(studentId, id, input) {
            const existing = await prisma.curriculum.findUnique({
                where: { studentId, id },
                select: {
                    catalogProgramId: true,
                    catalogSpecializationId: true,
                    catalogLanguageId: true,
                    catalogSpecialization: {
                        select: { specializationId: true }
                    },
                    catalogLanguage: { select: { languageId: true } }
                }
            });
            if (!existing) return err(curriculumNotFoundProblem());
            const requestedSelection = patchSelectionData(
                input.selection,
                existing
            );
            const selection = await resolveSelection(
                prisma,
                requestedSelection
            );
            const fields = await selectionFields(
                prisma,
                requestedSelection,
                selection
            );
            if (fields.length) return err(curriculumInputProblem(fields));
            try {
                await prisma.$transaction(async (tx) => {
                    if (input.periods) {
                        const errors = await patchPeriods(
                            tx,
                            id,
                            input.periods
                        );
                        if (errors.length)
                            throw new CurriculumOperationError(errors);
                    }
                    if (input.courses) {
                        const errors = await patchCourses(
                            tx,
                            id,
                            input.courses
                        );
                        if (errors.length)
                            throw new CurriculumOperationError(errors);
                    }
                    if (
                        input.currentPeriodId !== undefined &&
                        input.currentPeriodId !== null &&
                        !(await tx.curriculumPeriod.findFirst({
                            where: {
                                id: input.currentPeriodId,
                                curriculumId: id
                            },
                            select: { id: true }
                        }))
                    )
                        throw new CurriculumOperationError([
                            {
                                code: "REFERENCE_NOT_FOUND",
                                path: ["currentPeriodId"],
                                message:
                                    "O período atual deve pertencer ao planejamento."
                            }
                        ]);
                    await tx.curriculum.update({
                        where: { id },
                        data: {
                            ...(input.name !== undefined && {
                                name: input.name
                            }),
                            ...(input.selection && selection),
                            ...(input.planningStart !== undefined &&
                                planningStartData(input.planningStart)),
                            ...(input.currentPeriodId !== undefined && {
                                currentPeriodId: input.currentPeriodId
                            })
                        }
                    });
                    if (input.isFavorite !== undefined) {
                        const student = await tx.student.findUniqueOrThrow({
                            where: { id: studentId },
                            select: { favoriteCurriculumId: true }
                        });
                        await tx.student.update({
                            where: { id: studentId },
                            data: {
                                favoriteCurriculumId: input.isFavorite
                                    ? id
                                    : student.favoriteCurriculumId === id
                                      ? null
                                      : student.favoriteCurriculumId
                            }
                        });
                    }
                });
            } catch (error) {
                if (error instanceof CurriculumOperationError)
                    return err(curriculumInputProblem(error.fields));
                throw error;
            }
            return ok(
                curriculumEntity.build((await load(prisma, studentId, id))!)
            );
        },
        async remove(studentId, id) {
            const existing = await prisma.curriculum.findUnique({
                where: { studentId, id },
                select: { id: true }
            });
            if (!existing) return err(curriculumNotFoundProblem());
            await prisma.curriculum.delete({ where: { id } });
            return ok(undefined);
        }
    };
}
