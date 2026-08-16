import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, SpecBuilder } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const roomPaths = {
    entity: (id: number) => `/rooms/${id}`
};

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

export default {
    schema: roomEntity,
    get,
    list
};
