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
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Attempt = z.infer<typeof IO.schema>;
type CreateInput = z.infer<typeof IO.create.request>["body"];
type PatchInput = z.infer<typeof IO.patch.request>["body"];
type ListInput = z.infer<typeof IO.list.request>["query"];

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

async function validateReferences(
    prisma: PrismaClient,
    input: Pick<CreateInput, "courseId" | "studyPeriodId" | "classId">
) {
    const fields = [] as Array<{
        code: string;
        path: string[];
        message: string;
    }>;
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
                  select: { courseId: true, studyPeriodId: true }
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
    if (fields.length > 0) return { kind: "reference" as const, fields };
    if (input.classId == null) return null;
    const invalid = [] as Array<{
        code: string;
        path: string[];
        message: string;
    }>;
    if (input.studyPeriodId == null)
        invalid.push({
            code: "REQUIRED",
            path: ["studyPeriodId"],
            message: "Uma turma exige um período letivo."
        });
    if (classData!.courseId !== input.courseId)
        invalid.push({
            code: "INVALID_VALUE",
            path: ["classId"],
            message: "A turma deve pertencer à disciplina informada."
        });
    if (
        input.studyPeriodId != null &&
        classData!.studyPeriodId !== input.studyPeriodId
    )
        invalid.push({
            code: "INVALID_VALUE",
            path: ["classId"],
            message: "A turma deve pertencer ao período letivo informado."
        });
    return invalid.length > 0
        ? { kind: "invalid" as const, fields: invalid }
        : null;
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
                        ? { studyPeriodId: input.studyPeriodId }
                        : {})
                },
                orderBy: [
                    { studyPeriod: { startDate: "desc" } },
                    { createdAt: "desc" }
                ]
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
            const validation = await validateReferences(prisma, input);
            if (validation?.kind === "reference")
                return err(
                    studentCourseReferenceNotFoundProblem(validation.fields)
                );
            if (validation?.kind === "invalid")
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
                data: { studentId, ...input }
            });
            return ok(attemptEntity.build(attempt));
        },
        async patch(studentId, id, input) {
            const existing = await prisma.studentCourseAttempt.findFirst({
                where: { id, studentId }
            });
            if (!existing) return err(studentCourseAttemptNotFoundProblem());
            const next = {
                courseId: existing.courseId,
                studyPeriodId: existing.studyPeriodId,
                classId: existing.classId,
                status: existing.status,
                ...input
            };
            const validation = await validateReferences(prisma, next);
            if (validation?.kind === "reference")
                return err(
                    studentCourseReferenceNotFoundProblem(validation.fields)
                );
            if (validation?.kind === "invalid")
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
                data: input
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
