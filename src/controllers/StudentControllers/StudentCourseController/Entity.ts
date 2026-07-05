import z from "zod";
import { resourcesPaths } from "../../../Controllers.js";
import IO from "../../../Interfaces/students/StudentCourseInterface.js";
import { MyPrisma, selectIdCode } from "../../../PrismaClient.js";

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
        }
    }
} as const satisfies MyPrisma.StudentCourseDefaultArgs;

type PrismaStudentCoursePayload = MyPrisma.StudentCourseGetPayload<
    typeof prismaStudentCourseFieldSelection
>;

function relatedPathsForStudentCourse(
    studentCourse: PrismaStudentCoursePayload
) {
    return {
        self: resourcesPaths.studentCourse.entity(
            studentCourse.studentId,
            studentCourse.courseId
        ),
        student: resourcesPaths.student.entity(studentCourse.studentId),
        course: resourcesPaths.course.entity(studentCourse.course.id)
    };
}

function buildStudentCourseEntity(
    studentCourse: PrismaStudentCoursePayload
): z.infer<typeof IO.schema> {
    const { course, ...rest } = studentCourse;
    return {
        ...rest,
        course: {
            id: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits,
            unit: course.unit
        },
        _paths: relatedPathsForStudentCourse(studentCourse)
    };
}
export default {
    build: buildStudentCourseEntity,
    prismaSelection: prismaStudentCourseFieldSelection
};
