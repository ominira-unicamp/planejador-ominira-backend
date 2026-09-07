import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { getPaginatedSchema, pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const coursePaths = {
    list: (query: ListQueryParams = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) params.set(key, String(value));
        }
        const search = params.toString();
        return `/courses${search ? `?${search}` : ""}`;
    },
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
        unitId: z.number().int().nullable(),
        unitCode: z.string().min(1).nullable(),
        _paths: z
            .object({
                classes: z.string(),
                unit: z.string().nullable(),
                catalogCourses: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CourseEntity");

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
        courseCode: z.string().min(1).optional(),
        q: z.string().trim().min(1).optional(),
        catalogYear: z.coerce.number().int().optional(),
        tagId: z.coerce.number().int().positive().optional()
    })
    .openapi("ListCoursesQuery");
export type ListQueryParams = z.infer<typeof listCourseQuery>;

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

export default {
    schema: courseEntity,
    get,
    list
};
