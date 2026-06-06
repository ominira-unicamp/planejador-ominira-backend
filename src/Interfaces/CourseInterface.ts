import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { getPaginatedSchema, paginationQuerySchema } from "../pagination.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("courses")];
const tags = ["courses"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

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

const courseBase = z.object({
    id: z.number().int(),
    code: z.string().min(1),
    name: z.string().min(1),
    credits: z.number().int().min(0),
    instituteId: z.number().int()
});

const listCourseQuery = paginationQuerySchema
    .extend({
        instituteId: z.coerce.number().int().optional(),
        instituteCode: z.string().min(1).optional(),
        courseCode: z.string().min(1).optional()
    })
    .openapi("ListCoursesQuery");

const PageCoursesSchema =
    getPaginatedSchema(courseEntity).openapi("PageCourses");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z
            .object({
                id: z.coerce.number().int()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(courseEntity, "Course retrieved successfully")
        .notFound()
        .build()
};

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: listCourseQuery
    }),
    output: new OutputBuilder()
        .ok(PageCoursesSchema, "List of courses retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: courseBase.omit({ id: true }).strict().openapi("CreateCourseBody")
    }),
    output: new OutputBuilder()
        .created(courseEntity, "Course created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
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
    output: new OutputBuilder()
        .ok(courseEntity, "Course patched successfully")
        .notFound()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z
            .object({
                id: z.coerce.number().int()
            })
            .strict()
    }),
    output: new OutputBuilder()
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
