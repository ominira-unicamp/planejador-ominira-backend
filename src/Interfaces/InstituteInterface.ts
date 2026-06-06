import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("institutes")];
const tags = ["institutes"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const instituteEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        _paths: z
            .object({
                classes: z.string(),
                courses: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("InstituteEntity");

const instituteBase = z
    .object({
        id: z.number().int(),
        code: z.string().min(1)
    })
    .strict();

const createInstituteBody = instituteBase
    .omit({ id: true })
    .openapi("CreateInstituteBody");

const patchInstituteBody = instituteBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchInstituteBody");
const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(instituteEntity, "Institute retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({}),
    output: new OutputBuilder()
        .ok(
            z.array(instituteEntity),
            "List of institutes retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createInstituteBody.strict()
    }),
    output: new OutputBuilder()
        .created(instituteEntity, "Institute created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchInstituteBody
    }),
    output: new OutputBuilder()
        .ok(instituteEntity, "Institute updated successfully")
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
        .noContent("Institute deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: instituteEntity,
    get,
    list,
    create,
    patch,
    remove
};
