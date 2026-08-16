import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("calendar-tags")];
const tags = ["calendar-tags"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        name: z.string(),
        _paths: z.object({
            entity: z.string()
        })
    })
    .strict()
    .openapi("CalendarTag");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().positive())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Calendar tag retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({})
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of calendar tags retrieved successfully")
        .build()
} satisfies IO;

export default {
    schema,
    get,
    list
};
