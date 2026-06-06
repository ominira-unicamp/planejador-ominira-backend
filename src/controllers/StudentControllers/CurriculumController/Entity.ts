import z from "zod";
import { resourcesPaths } from "../../../Controllers.js";
import IO from "../../../Interfaces/students/CurriculumInterface.js";
import { MyPrisma } from "../../../PrismaClient.js";

export const prismaCurriculumFieldSelection = {
    include: {
        CurriculumCourses: {
            select: {
                courseId: true,
                semester: true,
                course: {
                    select: {
                        code: true,
                        name: true
                    }
                }
            }
        }
    }
} as const satisfies MyPrisma.CurriculumDefaultArgs;

type PrismaCurriculumPayload = MyPrisma.CurriculumGetPayload<
    typeof prismaCurriculumFieldSelection
>;

function relatedPathsForCurriculum(curriculumId: number, studentId: number) {
    return {
        self: resourcesPaths.curriculum.entity(studentId, curriculumId),
        student: resourcesPaths.student.entity(studentId)
    };
}

function buildCurriculumEntity(
    curriculum: PrismaCurriculumPayload
): z.infer<typeof IO.schema> {
    const { CurriculumCourses, ...rest } = curriculum;
    return {
        ...rest,
        courses: CurriculumCourses.map(({ courseId, course, semester }) => ({
            courseId: courseId,
            semester,
            name: course.name,
            code: course.code
        })),
        _paths: relatedPathsForCurriculum(curriculum.id, curriculum.studentId)
    };
}

export default {
    build: buildCurriculumEntity,
    prismaSelection: prismaCurriculumFieldSelection
};
