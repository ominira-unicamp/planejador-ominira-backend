import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../../BuildHandler.js";
import { pathSeg } from "../../PathSegment.js";
import { SpecBuilder } from "../../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("students")];
const tags = ["students"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const studentEntity = z
    .object({
        id: z.number().int(),
        ra: z.string(),
        name: z.string(),
        programId: z.number().int().nullable(),
        specializationId: z.number().int().nullable(),
        catalogId: z.number().int().nullable(),
        _paths: z.object({
            classes: z.string(),
            classSchedules: z.string()
        })
    })
    .strict()
    .openapi("StudentEntity");

const studentBase = z
    .object({
        id: z.number().int(),
        ra: z.string(),
        name: z.string(),
        programId: z.number().int().nullable().optional(),
        specializationId: z.number().int().nullable().optional(),
        catalogId: z.number().int().nullable().optional()
    })
    .strict();

const createStudentBody = studentBase
    .omit({ id: true })
    .openapi("CreateStudentBody");

const patchStudentBody = studentBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchStudentBody");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(studentEntity, "Student retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({}),
    output: new OutputBuilder()
        .ok(z.array(studentEntity), "List of students retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createStudentBody
    }),
    output: new OutputBuilder()
        .created(studentEntity, "Student created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchStudentBody
    }),
    output: new OutputBuilder()
        .ok(studentEntity, "Student updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Student deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: studentEntity,
    get,
    list,
    create,
    patch,
    remove
};
