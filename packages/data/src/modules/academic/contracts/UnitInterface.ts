import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("units")];
const tags = ["units"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const unitEntity = z
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
    .openapi("UnitEntity");

const unitBase = z
    .object({
        id: z.number().int(),
        code: z.string().min(1)
    })
    .strict();

const createUnitBody = unitBase.omit({ id: true }).openapi("CreateUnitBody");

const patchUnitBody = unitBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchUnitBody");
const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(unitEntity, "Unit retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({}),
    output: new OutputBuilder()
        .ok(z.array(unitEntity), "List of units retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createUnitBody.strict()
    }),
    output: new OutputBuilder()
        .created(unitEntity, "Unit created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchUnitBody
    }),
    output: new OutputBuilder()
        .ok(unitEntity, "Unit updated successfully")
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
        .noContent("Unit deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: unitEntity,
    get,
    list,
    create,
    patch,
    remove
};
