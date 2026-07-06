import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("buildings")];
const tags = ["buildings"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const baseBuildingSchema = z
    .object({
        id: z.number().int(),
        code: z.string().min(1),
        name: z.string().min(1),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
        unitId: z.number().int().nullable()
    })
    .strict();

const buildingEntitySchema = z
    .object({
        id: z.number().int().openapi({ example: 1 }),
        code: z.string().min(1).openapi({ example: "PB" }),
        name: z.string().min(1).openapi({ example: "Ciclo Basico II" }),
        latitude: z.number().nullable().openapi({ example: -23.5505 }),
        longitude: z.number().nullable().openapi({ example: -46.6333 }),
        unitId: z.number().int().nullable().openapi({ example: 10 }),
        unitCode: z.string().nullable().openapi({ example: "IC" }),
        _paths: z.object({
            self: z.string(),
            unit: z.string().nullable(),
            rooms: z.string()
        })
    })
    .strict()
    .openapi("BuildingEntity");

const createBuildingBody = baseBuildingSchema
    .omit({ id: true })
    .openapi("CreateBuildingBody");

const patchBuildingBody = createBuildingBody
    .partial()
    .openapi("PatchBuildingBody");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(buildingEntitySchema, "Building retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: z
            .object({
                unitId: z.coerce.number().int().optional()
            })
            .partial()
    }),
    output: new OutputBuilder()
        .ok(
            z.array(buildingEntitySchema),
            "List of buildings retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createBuildingBody
    }),
    output: new OutputBuilder()
        .created(buildingEntitySchema, "Building created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchBuildingBody
    }),
    output: new OutputBuilder()
        .ok(buildingEntitySchema, "Building updated successfully")
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
        .noContent("Building deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    get,
    list,
    create,
    patch,
    remove,
    schemas: { buildingEntitySchema, createBuildingBody, patchBuildingBody }
};
