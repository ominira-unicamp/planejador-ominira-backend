import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { pathSeg } from "#/PathSegment.js";
import { SpecBuilder } from "#/SpecBuilder.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("course-attempts")
];
const tags = ["student-course-attempts"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const StudentCourseAttemptStatus = {
    ENROLLED: "ENROLLED",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    DROPPED: "DROPPED"
} as const;

export const statusSchema = z.enum([
    "ENROLLED",
    "COMPLETED",
    "FAILED",
    "DROPPED"
]);
const gradeSchema = z.number().min(0).max(10).nullable();

const attemptEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        courseId: z.number().int(),
        studyPeriodId: z.number().int().nullable(),
        classId: z.number().int().nullable(),
        status: statusSchema,
        grade: z.number().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        course: z.object({
            id: z.number().int(),
            code: z.string(),
            name: z.string(),
            credits: z.number().int(),
            unit: z.object({ id: z.number().int(), code: z.string() })
        }),
        studyPeriod: z
            .object({ id: z.number().int(), code: z.string() })
            .nullable(),
        class: z
            .object({
                id: z.number().int(),
                code: z.string(),
                professors: z.array(
                    z.object({ id: z.number().int(), name: z.string() })
                )
            })
            .nullable(),
        _paths: z.object({
            self: z.string(),
            student: z.string(),
            course: z.string(),
            studyPeriod: z.string().nullable(),
            class: z.string().nullable()
        })
    })
    .strict()
    .openapi("StudentCourseAttempt");

const attemptBody = z
    .object({
        courseId: z.number().int(),
        studyPeriodId: z.number().int().nullable().optional(),
        classId: z.number().int().nullable().optional(),
        status: statusSchema,
        grade: gradeSchema.optional()
    })
    .strict();

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(attemptEntity, "Student course attempt retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        query: z.object({
            status: statusSchema.optional(),
            courseId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number())
                .optional(),
            studyPeriodId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number())
                .optional()
        })
    }),
    output: new OutputBuilder()
        .ok(
            z.array(attemptEntity),
            "Student course attempts retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: attemptBody
    }),
    output: new OutputBuilder()
        .created(attemptEntity, "Student course attempt created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: attemptBody.omit({ courseId: true }).partial().strict()
    }),
    output: new OutputBuilder()
        .ok(attemptEntity, "Student course attempt updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder().noContent().notFound().build()
} satisfies IO;

export default {
    schema: attemptEntity,
    statusSchema,
    get,
    list,
    create,
    patch,
    remove
};
