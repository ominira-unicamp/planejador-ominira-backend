import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO, { roomPaths } from "#/modules/academic/room/Room.contract.js";

extendZodWithOpenApi(z);

function withPaths(room: { id: number; code: string }) {
    return {
        ...room,
        _paths: {
            entity: roomPaths.entity(room.id)
        }
    };
}

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/rooms");
authRegistry.addException("GET", "/rooms/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const rooms = await ctx.prisma.room.findMany();
    const entities = rooms.map(withPaths);
    return { 200: entities };
};

const get = defaultGetHandler((p) => p.room, {}, withPaths, "Room not found");

router.get("/rooms/:id", get);

router.get("/rooms", buildHandler(IO.list.request, IO.list.response, listFn));

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: roomPaths.entity
    }
};
