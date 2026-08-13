import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

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
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(roomEntity, "Room retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(roomEntity), "List of rooms retrieved successfully")
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: createRoomBody.strict()
    }),
    response: new OutputBuilder()
        .created(roomEntity, "Room created successfully")
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
        body: patchRoomBody
    }),
    response: new OutputBuilder()
        .ok(roomEntity, "Room updated successfully")
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
