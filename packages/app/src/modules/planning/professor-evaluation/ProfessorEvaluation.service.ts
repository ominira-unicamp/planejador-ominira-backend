import IO from "#/modules/planning/professor-evaluation/ProfessorEvaluation.contract.js";
import { buildProfessorEvaluationEntity } from "#/modules/planning/professor-evaluation/ProfessorEvaluation.entity.js";
import {
    invalidProfessorEvaluationProblem,
    professorEvaluationReferenceNotFoundProblem,
    type ProfessorEvaluationProblem
} from "#/modules/planning/professor-evaluation/ProfessorEvaluation.problems.js";
import { isEligibleProfessorEvaluationAttempt } from "#/modules/planning/professor-evaluation/ProfessorEvaluation.rules.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Evaluation = z.infer<typeof IO.schema>;
type EvaluationBody = z.infer<typeof IO.put.request>["body"];
type PendingInput = z.infer<typeof IO.listPending.request>["query"];
type Eligibility = { eligible: boolean; evaluation: Evaluation | null };
type Context = { studentId: number; classId: number; professorId: number };
type PendingEvaluation = {
    attemptId: number;
    class: { id: number; code: string };
    course: { id: number; code: string; name: string };
    professor: { id: number; name: string };
};

export type ProfessorEvaluationService = {
    get(
        context: Context
    ): Promise<Result<Eligibility, ProfessorEvaluationProblem>>;
    put(
        context: Context,
        body: EvaluationBody
    ): Promise<Result<Evaluation, ProfessorEvaluationProblem>>;
    listPending(
        studentId: number,
        input: PendingInput
    ): Promise<PendingEvaluation[]>;
};

async function validateContext(prisma: PrismaClient, context: Context) {
    const [classData, professor, attempt] = await Promise.all([
        prisma.class.findUnique({
            where: { id: context.classId },
            select: {
                id: true,
                professors: {
                    where: { id: context.professorId },
                    select: { id: true }
                }
            }
        }),
        prisma.professor.findUnique({
            where: { id: context.professorId },
            select: { id: true }
        }),
        prisma.studentCourseAttempt.findFirst({
            where: { studentId: context.studentId, classId: context.classId },
            select: { status: true }
        })
    ]);

    const referenceFields = [] as Array<{
        code: string;
        path: string[];
        message: string;
    }>;
    if (!classData)
        referenceFields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["classId"],
            message: "A turma informada não foi encontrada."
        });
    if (!professor)
        referenceFields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["professorId"],
            message: "O professor informado não foi encontrado."
        });
    if (referenceFields.length > 0)
        return err(
            professorEvaluationReferenceNotFoundProblem(referenceFields)
        );

    if (classData!.professors.length === 0)
        return err(
            invalidProfessorEvaluationProblem([
                {
                    code: "INVALID_VALUE",
                    path: ["professorId"],
                    message: "O professor deve pertencer à turma informada."
                }
            ])
        );

    return ok({
        eligible:
            !!attempt && isEligibleProfessorEvaluationAttempt(attempt.status)
    });
}

export function createProfessorEvaluationService({
    prisma
}: {
    prisma: PrismaClient;
}): ProfessorEvaluationService {
    return {
        async get(context) {
            const validation = await validateContext(prisma, context);
            if (validation.isErr()) return validation;
            const evaluation = await prisma.professorEvaluation.findUnique({
                where: {
                    studentId_classId_professorId: context
                }
            });
            return ok({
                eligible: validation.value.eligible,
                evaluation: evaluation
                    ? buildProfessorEvaluationEntity(evaluation)
                    : null
            });
        },
        async put(context, body) {
            const validation = await validateContext(prisma, context);
            if (validation.isErr()) return validation;
            if (!validation.value.eligible)
                return err(
                    invalidProfessorEvaluationProblem([
                        {
                            code: "INVALID_VALUE",
                            path: ["classId"],
                            message:
                                "A avaliação exige uma tentativa encerrada nesta turma."
                        }
                    ])
                );
            const evaluation = await prisma.professorEvaluation.upsert({
                where: {
                    studentId_classId_professorId: context
                },
                create: { ...context, ...body },
                update: body
            });
            return ok(buildProfessorEvaluationEntity(evaluation));
        },
        async listPending(studentId, input) {
            const attempts = await prisma.studentCourseAttempt.findMany({
                where: {
                    studentId,
                    status: {
                        in: [
                            "DROPPED",
                            "APPROVED",
                            "FAILED_BY_GRADE",
                            "APPROVED_BY_ATTENDANCE",
                            "APPROVED_BY_PROFICIENCY",
                            "FAILED_BY_ATTENDANCE",
                            "SUFFICIENT",
                            "INSUFFICIENT"
                        ]
                    },
                    classId: { not: null },
                    class: {
                        studyPeriod: {
                            year: input.year,
                            yearPeriod: input.yearPeriod
                        }
                    }
                },
                select: {
                    id: true,
                    class: {
                        select: {
                            id: true,
                            code: true,
                            course: {
                                select: { id: true, code: true, name: true }
                            },
                            professors: { select: { id: true, name: true } }
                        }
                    }
                }
            });
            const evaluated = await prisma.professorEvaluation.findMany({
                where: {
                    studentId,
                    classId: {
                        in: attempts.flatMap((attempt) =>
                            attempt.class ? [attempt.class.id] : []
                        )
                    }
                },
                select: { classId: true, professorId: true }
            });
            const evaluatedKeys = new Set(
                evaluated.map(
                    (evaluation) =>
                        `${evaluation.classId}:${evaluation.professorId}`
                )
            );
            return attempts.flatMap((attempt) =>
                attempt.class
                    ? attempt.class.professors
                          .filter(
                              (professor) =>
                                  !evaluatedKeys.has(
                                      `${attempt.class!.id}:${professor.id}`
                                  )
                          )
                          .map((professor) => ({
                              attemptId: attempt.id,
                              class: {
                                  id: attempt.class!.id,
                                  code: attempt.class!.code
                              },
                              course: attempt.class!.course,
                              professor
                          }))
                    : []
            );
        }
    };
}
