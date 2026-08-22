import IO from "#/modules/planning/student-course-attempt/StudentCourseAttempt.contract.js";
import { MyPrisma, selectIdCode } from "@pomi/db";
import z from "zod";

export const prismaStudentCourseFieldSelection = {
    include: {
        course: {
            select: {
                id: true,
                code: true,
                name: true,
                credits: true,
                unit: selectIdCode
            }
        },
        studyPeriod: {
            select: { id: true, year: true, yearPeriod: true }
        },
        class: {
            select: {
                id: true,
                code: true,
                studyPeriod: {
                    select: { id: true, year: true, yearPeriod: true }
                },
                professors: { select: { id: true, name: true } }
            }
        }
    }
} as const satisfies MyPrisma.StudentCourseAttemptDefaultArgs;

type PrismaStudentCoursePayload = MyPrisma.StudentCourseAttemptGetPayload<
    typeof prismaStudentCourseFieldSelection
>;

function buildStudentCourseEntity(
    attempt: PrismaStudentCoursePayload
): z.infer<typeof IO.schema> {
    const {
        course,
        studyPeriod: storedStudyPeriod,
        class: classData,
        studyPeriodId: _storedStudyPeriodId,
        grade,
        createdAt,
        updatedAt,
        ...rest
    } = attempt;
    const resolvedStudyPeriod = classData?.studyPeriod ?? storedStudyPeriod;
    return {
        ...rest,
        studyPeriodId: resolvedStudyPeriod?.id ?? null,
        grade: grade === null ? null : Number(grade),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        course,
        studyPeriod: resolvedStudyPeriod
            ? {
                  id: resolvedStudyPeriod.id,
                  year: resolvedStudyPeriod.year,
                  yearPeriod: resolvedStudyPeriod.yearPeriod
              }
            : null,
        class: classData
            ? {
                  id: classData.id,
                  code: classData.code,
                  professors: classData.professors
              }
            : null,
        _paths: {
            self: `/student/${attempt.studentId}/course-attempts/${attempt.id}`,
            student: `/student/${attempt.studentId}`,
            course: `/courses/${course.id}`,
            studyPeriod: resolvedStudyPeriod
                ? `/study-periods/${resolvedStudyPeriod.id}`
                : null,
            class: classData ? `/classes/${classData.id}` : null
        }
    };
}

export default {
    build: buildStudentCourseEntity,
    prismaSelection: prismaStudentCourseFieldSelection
};
