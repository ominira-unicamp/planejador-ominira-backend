import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("programs")];
const tags = ["programs"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const schema = z
    .object({
        id: z.number().int(),
        code: z.number().int(),
        name: z.string(),
        unitId: z.number().int(),
        unit: z.object({
            id: z.number().int(),
            code: z.string()
        }),
        catalogProgramsCount: z.number().int(),
        studentsCount: z.number().int(),
        _paths: z.object({
            self: z.string(),
            unit: z.string()
        })
    })
    .openapi("Program");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Program retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z.object({
            unitId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int())
                .optional()
        })
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of programs retrieved successfully")
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: z
            .object({
                code: z.number().int().positive(),
                name: z.string().min(1),
                unitId: z.number().int()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .created(schema, "Program created successfully")
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
        body: z
            .object({
                code: z.number().int().positive().optional(),
                name: z.string().min(1).optional(),
                unitId: z.number().int().optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(schema, "Program updated successfully")
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
        .noContent("Program deleted successfully")
        .badRequest()
        .notFound()
        .build()
} satisfies IO;

export default {
    schema,
    get,
    list,
    create,
    patch,
    remove
};
