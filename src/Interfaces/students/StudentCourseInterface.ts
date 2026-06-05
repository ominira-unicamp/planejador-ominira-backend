import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../../BuildHandler.js";
import { pathSeg } from "../../PathSegment.js";
import { SpecBuilder } from "../../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("courses")
];
const tags = ["student-courses"];
const specBuilder = new SpecBuilder(basePath, tags, "courseId");

export const StudentCourseStatus = {
    ENROLLED: "ENROLLED",
    COMPLETED: "COMPLETED",
    DROPPED: "DROPPED"
} as const;

const res = Object.keys(StudentCourseStatus) as [
    keyof typeof StudentCourseStatus
];
export const statusSchema = z.enum(res);

const schema = z
    .object({
        studentId: z.number().int(),
        courseId: z.number().int(),
        status: statusSchema,
        course: z.object({
            id: z.number().int(),
            code: z.string(),
            name: z.string(),
            credits: z.number().int(),
            institute: z.object({
                id: z.number().int(),
                code: z.string()
            })
        }),
        _paths: z.object({
            self: z.string(),
            student: z.string(),
            course: z.string()
        })
    })
    .openapi("StudentCourse");

const get = {
    specs: specBuilder.get(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            courseId: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(schema, "Student course retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specBuilder.list(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        query: z.object({
            status: statusSchema.optional()
        })
    }),
    output: new OutputBuilder()
        .ok(z.array(schema), "List of student courses retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specBuilder.create(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                courseId: z.number().int(),
                status: z
                    .enum(StudentCourseStatus)
                    .default(StudentCourseStatus.ENROLLED)
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(schema, "Student course created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specBuilder.patch(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            courseId: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                status: statusSchema
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(schema, "Student course updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specBuilder.remove(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            courseId: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Student course deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema,
    statusSchema,
    get,
    list,
    create,
    patch,
    remove
};
