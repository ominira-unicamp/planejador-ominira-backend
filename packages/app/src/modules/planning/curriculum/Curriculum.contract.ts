import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidCurriculumProblem } from "#/modules/planning/curriculum/Curriculum.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ReferenceNotFoundProblemSchema,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

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
        isFavorite: z.boolean(),
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
        isFavorite: z.boolean(),
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

export const patchBody = z
    .object({
        name: z.string().trim().min(1).optional(),
        isFavorite: z.boolean().optional(),
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
    meta: {
        ...specBuilder.get(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({ path: pathWithId }),
    response: new OutputBuilder()
        .ok(curriculumEntity, "Curriculum retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: {
        ...specBuilder.list(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(
            z.array(curriculumSummaryEntity),
            "Curricula retrieved successfully"
        )
        .build()
} satisfies IO;

export const createBody = z
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
    meta: {
        ...specBuilder.create(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: createBody
    }),
    response: new OutputBuilder()
        .created(curriculumEntity, "Curriculum created successfully")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidCurriculumProblem.schema
            ]),
            "Planejamento curricular inválido"
        )
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specBuilder.patch(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({
        path: pathWithId,
        body: patchBody
    }),
    response: new OutputBuilder()
        .ok(curriculumEntity, "Curriculum updated successfully")
        .problem(404, ResourceNotFoundProblemSchema, "Currículo não encontrado")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidCurriculumProblem.schema
            ]),
            "Planejamento curricular inválido"
        )
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specBuilder.remove(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({ path: pathWithId }),
    response: new OutputBuilder()
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
