import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const unitPaths = {
    entity: (id: number) => `/units/${id}`
};

const basePath = [pathSeg.literal("units")];
const tags = ["units"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const unitEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
        _paths: z
            .object({
                classes: z.string(),
                courses: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("UnitEntity");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(unitEntity, "Unit retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(unitEntity), "List of units retrieved successfully")
        .build()
} satisfies IO;

export default {
    schema: unitEntity,
    get,
    list
};
