import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    PaginationQueryType,
    pathSeg,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("classes")];
const tags = ["classes"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const classEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        reservations: z.array(z.number().int()),
        courseId: z.number().int(),
        studyPeriodId: z.number().int(),
        professorIds: z.array(z.number().int()),
        studyPeriodCode: z.string(),
        courseCode: z.string(),
        unitId: z.number().int(),
        unitCode: z.string(),
        professors: z.array(
            z
                .object({
                    id: z.number().int(),
                    name: z.string()
                })
                .strict()
        ),
        _paths: z
            .object({
                studyPeriod: z.string(),
                unit: z.string(),
                course: z.string(),
                class: z.string(),
                classSchedules: z.string(),
                professors: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("ClassEntity");

const classBaseSchema = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        reservations: z.array(z.number().int()),
        courseId: z.number().int(),
        studyPeriodId: z.number().int(),
        professorIds: z.array(z.number().int())
    })
    .strict();

const createClassBody = classBaseSchema
    .omit({ id: true })
    .openapi("CreateClassBody");

const patchClassBody = classBaseSchema.partial().openapi("PatchClassBody");

const listClassesQuery = paginationQuerySchema
    .extend({
        classCode: z.string().optional(),
        unitId: z.coerce.number().int().optional(),
        unitCode: z.string().optional(),
        courseId: z.coerce.number().int().optional(),
        courseCode: z.string().optional(),
        studyPeriodId: z.coerce.number().int().optional(),
        studyPeriodCode: z.string().optional(),
        professorId: z.coerce.number().int().optional(),
        professorName: z.string().optional()
    })
    .openapi("GetClassesQuery");

const PageClassesSchema = getPaginatedSchema(classEntity);

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(classEntity, "Class retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: listClassesQuery
    }),
    output: new OutputBuilder()
        .ok(PageClassesSchema, "List of classes retrieved successfully")
        .badRequest()
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createClassBody.strict()
    }),
    output: new OutputBuilder()
        .created(classEntity, "Class created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchClassBody
    }),
    output: new OutputBuilder()
        .ok(classEntity, "Class updated successfully")
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
        .noContent("Class deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: classEntity,
    get,
    list,
    create,
    patch,
    remove
};

export type ListQueryParams = {
    unitId?: number | undefined;
    courseId?: number | undefined;
    studyPeriodId?: number | undefined;
    professorId?: number | undefined;
} & Partial<PaginationQueryType>;
