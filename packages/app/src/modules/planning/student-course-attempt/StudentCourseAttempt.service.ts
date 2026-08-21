import IO from "#/modules/planning/student-course-attempt/StudentCourseAttempt.contract.js";
import attemptEntity from "#/modules/planning/student-course-attempt/StudentCourseAttempt.entity.js";
import {
    activeStudentCourseAttemptProblem,
    invalidStudentCourseAttemptProblem,
    studentCourseAttemptNotFoundProblem,
    studentCourseReferenceNotFoundProblem,
    type StudentCourseAttemptProblem
} from "#/modules/planning/student-course-attempt/StudentCourseAttempt.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import { type CourseEvaluationMode, type PrismaClient } from "@pomi/db";
import z from "zod";

type Attempt = z.infer<typeof IO.schema>;
type CreateInput = z.infer<typeof IO.create.request>["body"];
type PatchInput = z.infer<typeof IO.patch.request>["body"];
type ListInput = z.infer<typeof IO.list.request>["query"];
type AttemptInput = Pick<
    CreateInput,
    | "courseId"
    | "studyPeriodId"
    | "classId"
    | "evaluationMode"
    | "status"
    | "grade"
>;

export type StudentCourseAttemptService = {
    list(studentId: number, input: ListInput): Promise<Attempt[]>;
    getById(
        studentId: number,
        id: number
    ): Promise<
        Result<Attempt, ReturnType<typeof studentCourseAttemptNotFoundProblem>>
    >;
    create(
        studentId: number,
        input: CreateInput
    ): Promise<
        Result<
            Attempt,
            Exclude<
                StudentCourseAttemptProblem,
                ReturnType<typeof studentCourseAttemptNotFoundProblem>
            >
        >
    >;
    patch(
        studentId: number,
        id: number,
        input: PatchInput
    ): Promise<Result<Attempt, StudentCourseAttemptProblem>>;
    remove(
        studentId: number,
        id: number
    ): Promise<
        Result<void, ReturnType<typeof studentCourseAttemptNotFoundProblem>>
    >;
};

type ValidationIssue = { code: string; path: string[]; message: string };

function invalidField(path: string[], message: string): ValidationIssue {
    return { code: "INVALID_VALUE", path, message };
}

function requiredField(path: string[], message: string): ValidationIssue {
    return { code: "REQUIRED", path, message };
}

function validateEvaluation(
    input: AttemptInput,
    evaluationMode: CourseEvaluationMode
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const grade = input.grade ?? null;
    const noResult = ["ENROLLED", "DROPPED"].includes(input.status);
    const gradeResults = ["APPROVED", "FAILED_BY_GRADE"];
    const allowedStatuses: Record<CourseEvaluationMode, string[]> = {
        GRADE_AND_ATTENDANCE: [
            "ENROLLED",
            "DROPPED",
            "APPROVED",
            "FAILED_BY_GRADE",
            "FAILED_BY_ATTENDANCE"
        ],
        ATTENDANCE: [
            "ENROLLED",
            "DROPPED",
            "APPROVED_BY_ATTENDANCE",
            "FAILED_BY_ATTENDANCE"
        ],
        CONCEPT: ["ENROLLED", "DROPPED", "SUFFICIENT", "INSUFFICIENT"]
    };
    if (!allowedStatuses[evaluationMode].includes(input.status))
        issues.push(
            invalidField(
                ["status"],
                "O resultado informado não é compatível com a modalidade de avaliação."
            )
        );
    if (noResult && grade !== null)
        issues.push(
            invalidField(
                ["grade"],
                "Tentativas cursando ou desistidas não possuem nota final."
            )
        );
    if (evaluationMode !== "GRADE_AND_ATTENDANCE" && grade !== null)
        issues.push(
            invalidField(
                ["grade"],
                "A modalidade de avaliação não aceita nota numérica."
            )
        );
    if (gradeResults.includes(input.status) && grade === null)
        issues.push(
            requiredField(["grade"], "O resultado por nota exige a nota final.")
        );
    return issues;
}

async function validateAttempt(
    prisma: PrismaClient,
    input: AttemptInput
): Promise<
    | { kind: "reference"; fields: ValidationIssue[] }
    | { kind: "invalid"; fields: ValidationIssue[] }
    | {
          kind: "valid";
          evaluationMode: CourseEvaluationMode;
          studyPeriodId: number | null;
      }
> {
    const fields: ValidationIssue[] = [];
    const [course, period, classData] = await Promise.all([
        prisma.course.findUnique({
            where: { id: input.courseId },
            select: { id: true }
        }),
        input.studyPeriodId == null
            ? undefined
            : prisma.studyPeriod.findUnique({
                  where: { id: input.studyPeriodId },
                  select: { id: true }
              }),
        input.classId == null
            ? undefined
            : prisma.class.findUnique({
                  where: { id: input.classId },
                  select: {
                      courseId: true,
                      studyPeriod: { select: { id: true, year: true } }
                  }
              })
    ]);
    if (!course)
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["courseId"],
            message: "A disciplina informada não foi encontrada."
        });
    if (input.studyPeriodId != null && !period)
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["studyPeriodId"],
            message: "O período letivo informado não foi encontrado."
        });
    if (input.classId != null && !classData)
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["classId"],
            message: "A turma informada não foi encontrada."
        });
    if (fields.length > 0) return { kind: "reference", fields };

    if (!classData) {
        if (!input.evaluationMode)
            return {
                kind: "invalid",
                fields: [
                    requiredField(
                        ["evaluationMode"],
                        "Uma tentativa sem turma exige a modalidade de avaliação."
                    )
                ]
            };
        const evaluationFields = validateEvaluation(
            input,
            input.evaluationMode
        );
        return evaluationFields.length > 0
            ? { kind: "invalid", fields: evaluationFields }
            : {
                  kind: "valid",
                  evaluationMode: input.evaluationMode,
                  studyPeriodId: input.studyPeriodId ?? null
              };
    }

    const invalid: ValidationIssue[] = [];
    if (classData.courseId !== input.courseId)
        invalid.push(
            invalidField(
                ["classId"],
                "A turma deve pertencer à disciplina informada."
            )
        );
    if (
        input.studyPeriodId != null &&
        classData.studyPeriod.id !== input.studyPeriodId
    )
        invalid.push(
            invalidField(
                ["studyPeriodId"],
                "O período informado deve ser o período da turma."
            )
        );
    const catalogCourse = await prisma.catalogCourse.findFirst({
        where: {
            courseId: classData.courseId,
            catalog: { year: classData.studyPeriod.year },
            evaluation: { not: null }
        },
        select: { evaluation: true }
    });
    if (!catalogCourse?.evaluation)
        invalid.push(
            invalidField(
                ["classId"],
                "A turma não possui modalidade de avaliação cadastrada no catálogo do seu ano."
            )
        );
    if (invalid.length > 0) return { kind: "invalid", fields: invalid };
    const evaluationMode = catalogCourse!.evaluation!;
    if (input.evaluationMode && input.evaluationMode !== evaluationMode)
        invalid.push(
            invalidField(
                ["evaluationMode"],
                "A modalidade de uma tentativa com turma é definida pelo catálogo da turma."
            )
        );
    invalid.push(...validateEvaluation(input, evaluationMode));
    return invalid.length > 0
        ? { kind: "invalid", fields: invalid }
        : { kind: "valid", evaluationMode, studyPeriodId: null };
}

export function createStudentCourseAttemptService({
    prisma
}: {
    prisma: PrismaClient;
}): StudentCourseAttemptService {
    return {
        async list(studentId, input) {
            const attempts = await prisma.studentCourseAttempt.findMany({
                ...attemptEntity.prismaSelection,
                where: {
                    studentId,
                    ...(input.status ? { status: input.status } : {}),
                    ...(input.courseId ? { courseId: input.courseId } : {}),
                    ...(input.studyPeriodId
                        ? {
                              OR: [
                                  { studyPeriodId: input.studyPeriodId },
                                  {
                                      class: {
                                          studyPeriodId: input.studyPeriodId
                                      }
                                  }
                              ]
                          }
                        : {})
                },
                orderBy: [{ createdAt: "desc" }]
            });
            return attempts.map(attemptEntity.build);
        },
        async getById(studentId, id) {
            const attempt = await prisma.studentCourseAttempt.findFirst({
                ...attemptEntity.prismaSelection,
                where: { id, studentId }
            });
            return attempt
                ? ok(attemptEntity.build(attempt))
                : err(studentCourseAttemptNotFoundProblem());
        },
        async create(studentId, input) {
            const validation = await validateAttempt(prisma, input);
            if (validation.kind === "reference")
                return err(
                    studentCourseReferenceNotFoundProblem(validation.fields)
                );
            if (validation.kind === "invalid")
                return err(
                    invalidStudentCourseAttemptProblem(validation.fields)
                );
            if (input.status === "ENROLLED") {
                const active = await prisma.studentCourseAttempt.findFirst({
                    where: {
                        studentId,
                        courseId: input.courseId,
                        status: "ENROLLED"
                    },
                    select: { id: true }
                });
                if (active) return err(activeStudentCourseAttemptProblem());
            }
            const attempt = await prisma.studentCourseAttempt.create({
                ...attemptEntity.prismaSelection,
                data: {
                    studentId,
                    courseId: input.courseId,
                    classId: input.classId ?? null,
                    studyPeriodId: validation.studyPeriodId,
                    evaluationMode: validation.evaluationMode,
                    status: input.status,
                    grade: input.grade ?? null
                }
            });
            return ok(attemptEntity.build(attempt));
        },
        async patch(studentId, id, input) {
            const existing = await prisma.studentCourseAttempt.findFirst({
                where: { id, studentId }
            });
            if (!existing) return err(studentCourseAttemptNotFoundProblem());
            const next: AttemptInput = {
                courseId: existing.courseId,
                studyPeriodId: existing.studyPeriodId,
                classId: existing.classId,
                evaluationMode:
                    input.evaluationMode ??
                    (input.classId !== undefined &&
                    input.classId !== existing.classId
                        ? undefined
                        : existing.evaluationMode),
                status: existing.status,
                grade: existing.grade === null ? null : Number(existing.grade),
                ...input
            };
            const validation = await validateAttempt(prisma, next);
            if (validation.kind === "reference")
                return err(
                    studentCourseReferenceNotFoundProblem(validation.fields)
                );
            if (validation.kind === "invalid")
                return err(
                    invalidStudentCourseAttemptProblem(validation.fields)
                );
            if (next.status === "ENROLLED") {
                const active = await prisma.studentCourseAttempt.findFirst({
                    where: {
                        studentId,
                        courseId: next.courseId,
                        status: "ENROLLED",
                        id: { not: id }
                    },
                    select: { id: true }
                });
                if (active) return err(activeStudentCourseAttemptProblem());
            }
            const attempt = await prisma.studentCourseAttempt.update({
                ...attemptEntity.prismaSelection,
                where: { id },
                data: {
                    classId: next.classId,
                    studyPeriodId: validation.studyPeriodId,
                    evaluationMode: validation.evaluationMode,
                    status: next.status,
                    grade: next.grade ?? null
                }
            });
            return ok(attemptEntity.build(attempt));
        },
        async remove(studentId, id) {
            const existing = await prisma.studentCourseAttempt.findFirst({
                where: { id, studentId },
                select: { id: true }
            });
            if (!existing) return err(studentCourseAttemptNotFoundProblem());
            await prisma.studentCourseAttempt.delete({ where: { id } });
            return ok(undefined);
        }
    };
}
