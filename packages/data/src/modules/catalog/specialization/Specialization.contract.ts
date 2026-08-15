import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("specializations")];
const tags = ["specializations"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");
const positiveId = z.number().int().positive();
const queryId = z.coerce.number().int().positive();
const specializationCode = z
    .string()
    .trim()
    .min(1)
    .transform((code) => code.toUpperCase());

const schema = z
    .object({
        id: positiveId,
        programId: positiveId,
        programCode: z.number().int().positive(),
        programName: z.string().trim().min(1),
        code: z.string(),
        name: z.string(),
        catalogSpecializationsCount: z.number().int(),
        studentsCount: z.number().int(),
        _paths: z.object({
            self: z.string(),
            program: z.string()
        })
    })
    .openapi("Specialization");

const get = {
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(schema, "Specialization retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: z
            .object({
                programId: queryId.optional(),
                programCode: z.coerce.number().int().positive().optional(),
                code: specializationCode.optional()
            })
            .strict()
    }),
    response: new OutputBuilder()
        .ok(z.array(schema), "List of specializations retrieved successfully")
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
                programId: positiveId,
                code: specializationCode,
                name: z.string().trim().min(1)
            })
            .strict()
    }),
    response: new OutputBuilder()
        .created(schema, "Specialization created successfully")
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
                code: specializationCode.optional(),
                name: z.string().trim().min(1).optional()
            })
            .strict()
            .refine((body) => Object.keys(body).length > 0, {
                message: "at least one field must be provided"
            })
    }),
    response: new OutputBuilder()
        .ok(schema, "Specialization updated successfully")
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
        .noContent("Specialization deleted successfully")
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
