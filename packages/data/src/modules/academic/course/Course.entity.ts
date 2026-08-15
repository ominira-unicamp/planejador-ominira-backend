import z from "zod";

import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/academic/course/Course.contract.js";
import { MyPrisma } from "@pomi/db";

const prismaCourseFieldSelection = {
    include: {
        unit: {
            select: {
                code: true
            }
        }
    }
} satisfies MyPrisma.CourseDefaultArgs;

type PrismaCoursePayload = MyPrisma.CourseGetPayload<
    typeof prismaCourseFieldSelection
>;

function relatedPathsForCourse(courseId: number, unitId: number) {
    return {
        classes: resourcesPaths.class.list({ courseId }),
        unit: resourcesPaths.unit.entity(unitId)
    };
}

function buildCourseEntity(
    course: PrismaCoursePayload
): z.infer<typeof IO.schema> {
    const { unit, ...rest } = course;
    return {
        ...rest,
        prefix: rest.code.slice(0, 2).toUpperCase(),
        unitCode: unit.code,
        _paths: relatedPathsForCourse(course.id, course.unitId)
    };
}

export default {
    selection: prismaCourseFieldSelection,
    build: buildCourseEntity
};
