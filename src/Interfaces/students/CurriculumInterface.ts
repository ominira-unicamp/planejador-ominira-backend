import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../../BuildHandler.js";
import { pathSeg } from "../../PathSegment.js";
import { SpecBuilder } from "../../SpecBuilder.js";

extendZodWithOpenApi(z);
const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("curricula")
];
const tags = ["curricula"];
const specBuilder = new SpecBuilder(basePath, tags, "id");

const curriculumEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        courses: z.array(
            z.object({
                courseId: z.number().int(),
                semester: z.number().int().nullable(),
                name: z.string(),
                code: z.string()
            })
        ),
        _paths: z.object({
            student: z.string()
        })
    })
    .strict()
    .openapi("CurriculumEntity");

const get = {
    specs: specBuilder.get(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(curriculumEntity, "Curriculum retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specBuilder.list(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(
            z.array(curriculumEntity),
            "List of curricula retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specBuilder.create(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .created(curriculumEntity, "Curriculum created successfully")
        .badRequest()
        .build()
} satisfies IO;

const curriculumCourse = z.object({
    courseId: z.number().int(),
    semester: z.number().int().nullable()
});

const patch = {
    specs: {
        method: "patch",
        path: basePath.concat(pathSeg.param("id")),
        tags
    },
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                id: z.number().int(),
                studentId: z.number().int(),
                courses: z
                    .object({
                        update: z.array(curriculumCourse),
                        set: z.array(curriculumCourse),
                        add: z.array(curriculumCourse),
                        upsert: z.array(curriculumCourse),
                        remove: z.array(z.number().int())
                    })
                    .partial()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(curriculumEntity, "Curriculum updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: {
        method: "delete",
        path: basePath.concat(pathSeg.param("id")),
        tags
    },
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Curriculum deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: curriculumEntity,
    get,
    list,
    create,
    patch,
    remove
};
