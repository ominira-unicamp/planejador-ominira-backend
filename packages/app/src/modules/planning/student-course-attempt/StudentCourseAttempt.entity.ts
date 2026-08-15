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
        studyPeriod: { select: { id: true, code: true } },
        class: {
            select: {
                id: true,
                code: true,
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
        studyPeriod,
        class: classData,
        grade,
        createdAt,
        updatedAt,
        ...rest
    } = attempt;
    return {
        ...rest,
        grade: grade === null ? null : Number(grade),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        course,
        studyPeriod,
        class: classData,
        _paths: {
            self: `/student/${attempt.studentId}/course-attempts/${attempt.id}`,
            student: `/student/${attempt.studentId}`,
            course: `/courses/${course.id}`,
            studyPeriod: studyPeriod
                ? `/study-periods/${studyPeriod.id}`
                : null,
            class: classData ? `/classes/${classData.id}` : null
        }
    };
}

export default {
    build: buildStudentCourseEntity,
    prismaSelection: prismaStudentCourseFieldSelection
};
