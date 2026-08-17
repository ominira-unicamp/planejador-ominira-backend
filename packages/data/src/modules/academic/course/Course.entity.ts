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

function relatedPathsForCourse(courseId: number, unitId: number | null) {
    return {
        classes: resourcesPaths.class.list({ courseId }),
        unit: unitId === null ? null : resourcesPaths.unit.entity(unitId),
        catalogCourses: resourcesPaths.catalogCourse.list({ courseId })
    };
}

function buildCourseEntity(
    course: PrismaCoursePayload
): z.infer<typeof IO.schema> {
    const { unit, ...rest } = course;
    return {
        ...rest,
        prefix: rest.code.slice(0, 2).toUpperCase(),
        unitCode: unit?.code ?? null,
        _paths: relatedPathsForCourse(course.id, course.unitId)
    };
}

export default {
    selection: prismaCourseFieldSelection,
    build: buildCourseEntity
};
