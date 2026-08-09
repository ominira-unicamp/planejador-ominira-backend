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

const selection = z
    .object({
        catalogProgramId: z.number().int().nullable(),
        catalogSpecializationId: z.number().int().nullable(),
        catalogLanguageId: z.number().int().nullable()
    })
    .strict();

const planningStart = z
    .object({
        year: z.number().int(),
        semester: z.union([z.literal(1), z.literal(2)]),
        semesterNumber: z.number().int().positive()
    })
    .strict();

const period = z
    .object({
        id: z.number().int(),
        position: z.number().int().positive()
    })
    .strict();

const course = z
    .object({
        courseId: z.number().int(),
        periodId: z.number().int().nullable(),
        name: z.string(),
        code: z.string(),
        credits: z.number().int()
    })
    .strict();

const curriculumEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        name: z.string(),
        selection,
        planningStart: planningStart.nullable(),
        currentPeriodId: z.number().int().nullable(),
        courses: z.array(course),
        periods: z.array(period),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        _paths: z
            .object({
                self: z.string(),
                student: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CurriculumEntity");

const curriculumSummaryEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        name: z.string(),
        selection,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        _paths: z
            .object({
                self: z.string(),
                student: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("CurriculumSummaryEntity");

const curriculumCourseInput = z
    .object({
        courseId: z.number().int(),
        periodId: z.number().int().nullable()
    })
    .strict();

const periodAdd = z.object({ position: z.number().int().positive() }).strict();
const periodUpdate = z
    .object({
        id: z.number().int(),
        position: z.number().int().positive()
    })
    .strict();

const patchBody = z
    .object({
        name: z.string().trim().min(1).optional(),
        selection: selection.partial().optional(),
        planningStart: planningStart.nullable().optional(),
        currentPeriodId: z.number().int().nullable().optional(),
        periods: z
            .object({
                add: z.array(periodAdd).optional(),
                update: z.array(periodUpdate).optional(),
                remove: z.array(z.number().int()).optional()
            })
            .strict()
            .optional(),
        courses: z
            .object({
                upsert: z.array(curriculumCourseInput).optional(),
                remove: z.array(z.number().int()).optional()
            })
            .strict()
            .optional()
    })
    .strict();

const pathWithId = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
    id: z.string().pipe(z.coerce.number()).pipe(z.number())
});

const get = {
    specs: specBuilder.get(),
    input: z.object({ path: pathWithId }),
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
            z.array(curriculumSummaryEntity),
            "Curricula retrieved successfully"
        )
        .build()
} satisfies IO;

const createBody = z
    .object({
        name: z.string().trim().min(1).optional(),
        selection: selection.partial().optional(),
        planningStart: planningStart.nullable().optional(),
        currentPeriodId: z.number().int().nullable().optional(),
        periods: z.array(periodAdd).optional(),
        courses: z.array(curriculumCourseInput).optional()
    })
    .strict();

const create = {
    specs: specBuilder.create(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: createBody
    }),
    output: new OutputBuilder()
        .created(curriculumEntity, "Curriculum created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specBuilder.patch(),
    input: z.object({
        path: pathWithId,
        body: patchBody
    }),
    output: new OutputBuilder()
        .ok(curriculumEntity, "Curriculum updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specBuilder.remove(),
    input: z.object({ path: pathWithId }),
    output: new OutputBuilder()
        .noContent("Curriculum deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: curriculumEntity,
    summarySchema: curriculumSummaryEntity,
    get,
    list,
    create,
    patch,
    remove
};
