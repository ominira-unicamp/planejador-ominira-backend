import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { getPaginatedSchema, pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const coursePaths = {
    entity: (id: number) => `/courses/${id}`
};

const basePath = [pathSeg.literal("courses")];
const tags = ["courses"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const courseEntity = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        credits: z.number().int().min(0),
        prefix: z.string().min(1),
        unitId: z.number().int(),
        unitCode: z.string().min(1),
        _paths: z
            .object({
                classes: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CourseEntity");

const courseBase = z.object({
    id: z.number().int(),
    code: z.string().min(1),
    name: z.string().min(1),
    credits: z.number().int().min(0),
    unitId: z.number().int()
});

const listCourseQuery = z
    .object({
        page: z.coerce.number().int().min(1).optional().openapi({
            description:
                "Page number. If omitted together with pageSize, all courses are returned."
        }),
        pageSize: z.coerce.number().int().min(1).optional().openapi({
            description:
                "Number of courses per page. If omitted together with page, all courses are returned."
        }),
        unitId: z.coerce.number().int().optional(),
        unitCode: z.string().min(1).optional(),
        courseCode: z.string().min(1).optional()
    })
    .openapi("ListCoursesQuery");

const PageCoursesSchema =
    getPaginatedSchema(courseEntity).openapi("PageCourses");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z
            .object({
                id: z.coerce.number().int()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(courseEntity, "Course retrieved successfully")
        .notFound()
        .build()
};

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: listCourseQuery
    }),
    response: new OutputBuilder()
        .ok(PageCoursesSchema, "List of courses retrieved successfully")
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: courseBase.omit({ id: true }).strict().openapi("CreateCourseBody")
    }),
    response: new OutputBuilder()
        .created(courseEntity, "Course created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z
            .object({
                id: z.string().pipe(z.coerce.number()).pipe(z.number())
            })
            .strict(),
        body: courseBase
            .omit({ id: true })
            .partial()
            .strict()
            .openapi("PatchCourseBody")
    }),
    response: new OutputBuilder()
        .ok(courseEntity, "Course patched successfully")
        .badRequest()
        .notFound()
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z
            .object({
                id: z.coerce.number().int()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .noContent("Course deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: courseEntity,
    get,
    list,
    create,
    patch,
    remove
};
