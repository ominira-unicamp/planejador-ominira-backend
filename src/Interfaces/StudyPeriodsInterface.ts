import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

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
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(studyPeriodEntity, "Study period retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({}),
    output: new OutputBuilder()
        .ok(
            z.array(studyPeriodEntity),
            "List of study periods retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createStudyPeriodBody.strict()
    }),
    output: new OutputBuilder()
        .created(studyPeriodEntity, "Study period created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchStudyPeriodBody
    }),
    output: new OutputBuilder()
        .ok(studyPeriodEntity, "Study period patched successfully")
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
