import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const studyPeriodPaths = {
    entity: (id: number) => `/study-periods/${id}`
};

const basePath = [pathSeg.literal("study-periods")];
const tags = ["study-periods"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const studyPeriodEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
        _paths: z.object({
            classes: z.string(),
            classSchedules: z.string()
        })
    })
    .strict()
    .openapi("StudyPeriodEntity");

const studyPeriodBase = z
    .object({
        id: z.number().int(),
        code: z.string(),
        startDate: z.union([z.string(), z.date()]).pipe(z.coerce.date())
    })
    .strict();

const createStudyPeriodBody = studyPeriodBase
    .omit({ id: true })
    .openapi("CreateStudyPeriodBody");

const patchStudyPeriodBody = studyPeriodBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchStudyPeriodBody");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(studyPeriodEntity, "Study period retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(
            z.array(studyPeriodEntity),
            "List of study periods retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: createStudyPeriodBody.strict()
    }),
    response: new OutputBuilder()
        .created(studyPeriodEntity, "Study period created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchStudyPeriodBody
    }),
    response: new OutputBuilder()
        .ok(studyPeriodEntity, "Study period patched successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .noContent("Study period deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: studyPeriodEntity,
    get,
    list,
    create,
    patch,
    remove
};
