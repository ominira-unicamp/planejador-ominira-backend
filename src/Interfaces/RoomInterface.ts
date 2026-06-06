import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("rooms")];
const tags = ["rooms"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const roomEntity = z
    .object({
        id: z.number().int(),
        code: z.string(),
        _paths: z.object({
            entity: z.string()
        })
    })
    .strict()
    .openapi("RoomEntity");

const roomBase = z
    .object({
        id: z.number().int(),
        code: z.string().min(1)
    })
    .strict();

const createRoomBody = roomBase.omit({ id: true }).openapi("CreateRoomBody");

const patchRoomBody = roomBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchRoomBody");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(roomEntity, "Room retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({}),
    output: new OutputBuilder()
        .ok(z.array(roomEntity), "List of rooms retrieved successfully")
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createRoomBody.strict()
    }),
    output: new OutputBuilder()
        .created(roomEntity, "Room created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchRoomBody
    }),
    output: new OutputBuilder()
        .ok(roomEntity, "Room updated successfully")
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
        .noContent("Room deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: roomEntity,
    get,
    list,
    create,
    patch,
    remove
};
