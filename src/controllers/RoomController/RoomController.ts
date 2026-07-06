import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "../../auth.js";
import {
    buildHandler,
    HandlerFn,
    openApiArgsFromIO
} from "../../BuildHandler.js";
import { defaultGetHandler } from "../../defaultEndpoint.js";
import IO, { RoomListQueryParams } from "../../Interfaces/RoomInterface.js";
import { whereIdCode } from "../../PrismaClient.js";
import { ValidationError, ZodToApiError } from "../../Validation.js";
import roomEntity from "./Entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/rooms");
authRegistry.addException("GET", "/rooms/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const hasUnitFilter =
        input.query.unitId !== undefined || input.query.unitCode !== undefined;
    const hasBuildingFilter =
        input.query.buildingId !== undefined ||
        input.query.buildingCode !== undefined ||
        hasUnitFilter;
    const rooms = await ctx.prisma.room.findMany({
        ...roomEntity.selection,
        where: {
            building: hasBuildingFilter
                ? {
                      ...whereIdCode(
                          input.query.buildingId,
                          input.query.buildingCode
                      ),
                      unit: hasUnitFilter
                          ? whereIdCode(
                                input.query.unitId,
                                input.query.unitCode
                            )
                          : undefined
                  }
                : undefined
        },
        orderBy: {
            code: "asc"
        }
    });
    const entities = rooms.map(roomEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.room,
    {},
    roomEntity.build,
    "Room not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;
    const existing = await ctx.prisma.room.findUnique({
        where: { code: body.code }
    });
    if (existing) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "code"],
                    message: "A room with this code already exists"
                }
            ])
        };
    }

    const validationSchema = z.object({
        buildingId: ctx.zodIds.building.exists
    });

    const validation = await validationSchema.safeParseAsync(body);
    if (!validation.success) {
        return {
            400: new ValidationError(ZodToApiError(validation.error, ["body"]))
        };
    }
    const room = await ctx.prisma.room.create({
        ...roomEntity.selection,
        data: {
            code: body.code,
            details: body.details,
            atlasId: body.atlasId,
            buildingId: body.buildingId
        }
    });
    return { 201: roomEntity.build(room) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;
    const existing = await ctx.prisma.room.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Room not found" } };

    if (body.code !== undefined) {
        const codeExists = await ctx.prisma.room.findUnique({
            where: { code: body.code }
        });
        if (codeExists && codeExists.id !== id) {
            return {
                400: new ValidationError([
                    {
                        code: "ALREADY_EXISTS",
                        path: ["body", "code"],
                        message: "A room with this code already exists"
                    }
                ])
            };
        }
    }

    const room = await ctx.prisma.room.update({
        ...roomEntity.selection,
        where: { id },
        data: {
            ...(body.code !== undefined && { code: body.code }),
            ...(body.details !== undefined && { details: body.details }),
            ...(body.atlasId !== undefined && { atlasId: body.atlasId }),
            ...(body.buildingId !== undefined && {
                buildingId: body.buildingId
            })
        }
    });
    return { 200: roomEntity.build(room) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;
    const existing = await ctx.prisma.room.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Room not found" } };
    await ctx.prisma.room.delete({ where: { id } });
    return { 204: null };
};

router.get("/rooms/:id", get);

router.get("/rooms", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/rooms",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/rooms/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/rooms/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function listPath(query: RoomListQueryParams): string {
    const params = new URLSearchParams();
    ["buildingId", "buildingCode", "unitId", "unitCode"].forEach((key) => {
        const value = query[key as keyof RoomListQueryParams];
        if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return queryString ? `/rooms?${queryString}` : `/rooms`;
}

function entityPath(roomId: number) {
    return `/rooms/${roomId}`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    }
};
