import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";
import {
    buildHandler,
    HandlerFn,
    openApiArgsFromIO
} from "../../BuildHandler.js";
import IO from "../../Interfaces/BuildingInterface.js";
import { ValidationError, ZodToApiError } from "../../Validation.js";
import { AuthRegistry } from "../../auth.js";
import { defaultGetHandler } from "../../defaultEndpoint.js";
import buildingEntity from "./Entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/buildings");
authRegistry.addException("GET", "/buildings/:id");

type ListQueryParams = z.infer<typeof IO.list.input>["query"];

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { query } = input;

    const buildings = await ctx.prisma.building.findMany({
        ...buildingEntity.prismaSelection,
        where: {
            ...(query?.unitId !== undefined && { unitId: query.unitId })
        },
        orderBy: {
            name: "asc"
        }
    });

    const entities = buildings.map(buildingEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.building,
    buildingEntity.prismaSelection,
    buildingEntity.build,
    "Building not found"
);

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;

    const validationSchema = z.object({
        unitId: ctx.zodIds.unit.exists.nullable()
    });

    const validation = await validationSchema.safeParseAsync({
        unitId: body.unitId
    });

    if (!validation.success) {
        return {
            400: new ValidationError(ZodToApiError(validation.error, ["body"]))
        };
    }

    const existing = await ctx.prisma.building.findFirst({
        where: { code: body.code, unitId: body.unitId ?? null }
    });

    if (existing) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "code"],
                    message: "A building with this code and unit already exists"
                }
            ])
        };
    }

    const buildingData = await ctx.prisma.building.create({
        data: {
            code: body.code,
            name: body.name,
            latitude: body.latitude,
            longitude: body.longitude,
            unitId: body.unitId
        },
        ...buildingEntity.prismaSelection
    });

    return { 201: buildingEntity.build(buildingData) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;

    const existing = await ctx.prisma.building.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Building not found" } };

    if (body.unitId !== undefined && body.unitId !== null) {
        const validationSchema = z.object({
            unitId: ctx.zodIds.unit.exists
        });

        const validation = await validationSchema.safeParseAsync({
            unitId: body.unitId
        });
        if (!validation.success) {
            return {
                400: new ValidationError(
                    ZodToApiError(validation.error, ["body"])
                )
            };
        }
    }

    if (body.code !== undefined || body.unitId !== undefined) {
        const existingUniqueCheck = await ctx.prisma.building.findFirst({
            where: {
                code: body.code === undefined ? existing.code : body.code,
                unitId:
                    body.unitId === undefined ? existing.unitId : body.unitId
            }
        });

        if (existingUniqueCheck && existingUniqueCheck.id !== id) {
            const errorPath = body.code !== undefined ? "code" : "unitId";
            return {
                400: new ValidationError([
                    {
                        code: "ALREADY_EXISTS",
                        path: ["body", errorPath],
                        message:
                            "A building with this code and unit already exists"
                    }
                ])
            };
        }
    }

    const buildingData = await ctx.prisma.building.update({
        where: { id },
        data: {
            ...(body.code !== undefined && { code: body.code }),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.latitude !== undefined && { latitude: body.latitude }),
            ...(body.longitude !== undefined && { longitude: body.longitude }),
            ...(body.unitId !== undefined && { unitId: body.unitId })
        },
        ...buildingEntity.prismaSelection
    });

    return { 200: buildingEntity.build(buildingData) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.building.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Building not found" } };

    await ctx.prisma.building.delete({ where: { id } });
    return { 204: null };
};

router.get("/buildings/:id", get);

router.get("/buildings", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/buildings",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/buildings/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/buildings/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function listPath(query: ListQueryParams) {
    return query.unitId !== undefined
        ? `/buildings?unitId=${query.unitId}`
        : "/buildings";
}

function entityPath(id: number) {
    return `/buildings/${id}`;
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
        list: listPath,
        entity: entityPath
    }
};
