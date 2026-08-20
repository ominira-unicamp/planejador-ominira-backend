import IO from "#/modules/planning/student-absence/StudentAbsence.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaStudentAbsenceSelection = {
    include: {
        studentCourseAttempt: {
            select: { id: true, studentId: true }
        },
        classSchedule: {
            select: {
                id: true,
                dayOfWeek: true,
                start: true,
                end: true,
                class: {
                    select: {
                        id: true,
                        code: true,
                        course: { select: { id: true, code: true } },
                        studyPeriod: { select: { id: true, code: true } }
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.StudentAbsenceDefaultArgs;

type PrismaStudentAbsencePayload = MyPrisma.StudentAbsenceGetPayload<
    typeof prismaStudentAbsenceSelection
>;

function buildStudentAbsenceEntity(
    absence: PrismaStudentAbsencePayload
): z.infer<typeof IO.schema> {
    const { classSchedule, studentCourseAttempt, ...data } = absence;
    const { class: classData, ...schedule } = classSchedule;
    return {
        ...data,
        date: absence.date.toISOString().slice(0, 10),
        createdAt: absence.createdAt.toISOString(),
        updatedAt: absence.updatedAt.toISOString(),
        studyPeriodId: classData.studyPeriod.id,
        studyPeriodCode: classData.studyPeriod.code,
        courseId: classData.course.id,
        courseCode: classData.course.code,
        classId: classData.id,
        classCode: classData.code,
        dayOfWeek: schedule.dayOfWeek,
        start: schedule.start,
        end: schedule.end,
        _paths: {
            self: `/student/${studentCourseAttempt.studentId}/absences/${absence.id}`,
            courseAttempt: `/student/${studentCourseAttempt.studentId}/course-attempts/${absence.studentCourseAttemptId}`,
            classSchedule: `/class-schedules/${absence.classScheduleId}`,
            class: `/classes/${classData.id}`,
            course: `/courses/${classData.course.id}`,
            studyPeriod: `/study-periods/${classData.studyPeriod.id}`
        }
    };
}

export default {
    build: buildStudentAbsenceEntity,
    prismaSelection: prismaStudentAbsenceSelection
};
