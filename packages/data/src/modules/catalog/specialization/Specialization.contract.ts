import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
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
export default {
    schema,
    get,
    list
};
