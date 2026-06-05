import z from "zod";

import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/CourseInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

const prismaCourseFieldSelection = {
    include: {
        institute: {
            select: {
                code: true
            }
        }
    }
} satisfies MyPrisma.CourseDefaultArgs;

type PrismaCoursePayload = MyPrisma.CourseGetPayload<
    typeof prismaCourseFieldSelection
>;

function relatedPathsForCourse(courseId: number, instituteId: number) {
    return {
        classes: resourcesPaths.class.list({ courseId }),
        institute: resourcesPaths.institute.entity(instituteId)
    };
}

function buildCourseEntity(
    course: PrismaCoursePayload
): z.infer<typeof IO.schema> {
    const { institute, ...rest } = course;
    return {
        ...rest,
        instituteCode: institute.code,
        _paths: relatedPathsForCourse(course.id, course.instituteId)
    };
}

export default {
    selection: prismaCourseFieldSelection,
    build: buildCourseEntity
};
