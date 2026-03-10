import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { resourcesPaths } from "../../Controllers.js";
import { MyPrisma } from "../../PrismaClient.js";
extendZodWithOpenApi(z);

const courseEntity = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        credits: z.number().int().min(0),
        instituteId: z.number().int(),
        instituteCode: z.string().min(1),
        _paths: z
            .object({
                classes: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CourseEntity");

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
): z.infer<typeof courseEntity> {
    const { institute, ...rest } = course;
    return {
        ...rest,
        instituteCode: institute.code,
        _paths: relatedPathsForCourse(course.id, course.instituteId)
    };
}

export default {
    selection: prismaCourseFieldSelection,
    schema: courseEntity,
    build: buildCourseEntity
};
