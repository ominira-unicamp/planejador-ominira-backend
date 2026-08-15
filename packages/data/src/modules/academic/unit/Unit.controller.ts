import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/academic/unit/Unit.contract.js";
import unitEntity from "#/modules/academic/unit/Unit.entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/units");
authRegistry.addException("GET", "/units/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const units = await ctx.prisma.unit.findMany();
    const entities = units.map(unitEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.unit,
    {},
    unitEntity.build,
    "Unit not found"
);

router.get("/units/:id", get);

router.get("/units", buildHandler(IO.list.request, IO.list.response, listFn));

function entityPath(unitId: number) {
    return `/units/${unitId}`;
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath
    }
};
