import IO from "#/modules/planning/student-absence/StudentAbsence.contract.js";
import absenceEntity from "#/modules/planning/student-absence/StudentAbsence.entity.js";
import {
    duplicateStudentAbsenceProblem,
    invalidStudentAbsenceProblem,
    studentAbsenceNotFoundProblem,
    studentAbsenceReferenceNotFoundProblem,
    type StudentAbsenceProblem
} from "#/modules/planning/student-absence/StudentAbsence.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Absence = z.infer<typeof IO.schema>;
type CreateInput = z.infer<typeof IO.create.request>["body"];
type ListInput = z.infer<typeof IO.list.request>["query"];
type CreateProblem = Exclude<
    StudentAbsenceProblem,
    ReturnType<typeof studentAbsenceNotFoundProblem>
>;

const dayOfWeekByDateDay = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY"
] as const;

function dateDayOfWeek(date: string) {
    return dayOfWeekByDateDay[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
}

export type StudentAbsenceService = {
    list(studentId: number, input: ListInput): Promise<Absence[]>;
    create(
        studentId: number,
        input: CreateInput
    ): Promise<Result<Absence, CreateProblem>>;
    remove(
        studentId: number,
        id: number
    ): Promise<Result<void, ReturnType<typeof studentAbsenceNotFoundProblem>>>;
};

export function createStudentAbsenceService({
    prisma
}: {
    prisma: PrismaClient;
}): StudentAbsenceService {
    return {
        async list(studentId, input) {
            const absences = await prisma.studentAbsence.findMany({
                ...absenceEntity.prismaSelection,
                where: {
                    studentCourseAttempt: {
                        studentId,
                        ...(input.courseAttemptId
                            ? { id: input.courseAttemptId }
                            : {})
                    }
                },
                orderBy: [{ date: "desc" }, { id: "desc" }]
            });
            return absences.map(absenceEntity.build);
        },
        async create(studentId, input) {
            const [attempt, schedule] = await Promise.all([
                prisma.studentCourseAttempt.findFirst({
                    where: { id: input.courseAttemptId, studentId },
                    select: { id: true, classId: true }
                }),
                prisma.classSchedule.findUnique({
                    where: { id: input.classScheduleId },
                    select: { id: true, classId: true, dayOfWeek: true }
                })
            ]);
            const referenceFields = [] as Array<{
                code: string;
                path: string[];
                message: string;
            }>;
            if (!attempt)
                referenceFields.push({
                    code: "REFERENCE_NOT_FOUND",
                    path: ["courseAttemptId"],
                    message:
                        "A tentativa de disciplina informada não foi encontrada."
                });
            if (!schedule)
                referenceFields.push({
                    code: "REFERENCE_NOT_FOUND",
                    path: ["classScheduleId"],
                    message: "O horário de turma informado não foi encontrado."
                });
            if (referenceFields.length > 0)
                return err(
                    studentAbsenceReferenceNotFoundProblem(referenceFields)
                );

            const invalidFields = [] as Array<{
                code: string;
                path: string[];
                message: string;
            }>;
            if (attempt!.classId === null)
                invalidFields.push({
                    code: "REQUIRED",
                    path: ["courseAttemptId"],
                    message: "Uma falta exige que a tentativa tenha uma turma."
                });
            if (attempt!.classId !== schedule!.classId)
                invalidFields.push({
                    code: "INVALID_VALUE",
                    path: ["classScheduleId"],
                    message: "O horário deve pertencer à turma da tentativa."
                });
            if (dateDayOfWeek(input.date) !== schedule!.dayOfWeek)
                invalidFields.push({
                    code: "INVALID_VALUE",
                    path: ["date"],
                    message:
                        "A data deve corresponder ao dia da semana do horário."
                });
            if (invalidFields.length > 0)
                return err(invalidStudentAbsenceProblem(invalidFields));

            const existing = await prisma.studentAbsence.findUnique({
                where: {
                    studentCourseAttemptId_classScheduleId_date: {
                        studentCourseAttemptId: input.courseAttemptId,
                        classScheduleId: input.classScheduleId,
                        date: new Date(`${input.date}T00:00:00.000Z`)
                    }
                },
                select: { id: true }
            });
            if (existing) return err(duplicateStudentAbsenceProblem());
            const absence = await prisma.studentAbsence.create({
                ...absenceEntity.prismaSelection,
                data: {
                    studentCourseAttemptId: input.courseAttemptId,
                    classScheduleId: input.classScheduleId,
                    date: new Date(`${input.date}T00:00:00.000Z`)
                }
            });
            return ok(absenceEntity.build(absence));
        },
        async remove(studentId, id) {
            const absence = await prisma.studentAbsence.findFirst({
                where: { id, studentCourseAttempt: { studentId } },
                select: { id: true }
            });
            if (!absence) return err(studentAbsenceNotFoundProblem());
            await prisma.studentAbsence.delete({ where: { id } });
            return ok(undefined);
        }
    };
}
