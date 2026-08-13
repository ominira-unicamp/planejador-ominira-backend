import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/planning/contracts/students/StudentCourseInterface.js";
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
            self: resourcesPaths.studentCourse.entity(
                attempt.studentId,
                attempt.id
            ),
            student: resourcesPaths.student.entity(attempt.studentId),
            course: resourcesPaths.course.entity(course.id),
            studyPeriod: studyPeriod
                ? resourcesPaths.studyPeriod.entity(studyPeriod.id)
                : null,
            class: classData ? resourcesPaths.class.entity(classData.id) : null
        }
    };
}

export default {
    build: buildStudentCourseEntity,
    prismaSelection: prismaStudentCourseFieldSelection
};
