import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/catalog/program/Program.contract.js";
import programEntity from "#/modules/catalog/program/Program.entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/programs/:id");
authRegistry.addException("GET", "/programs");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { query } = input;
    const programs = await ctx.prisma.program.findMany({
        ...programEntity.prismaSelection,
        where: {
            ...(query?.unitId && { unitId: query.unitId })
        },
        orderBy: {
            name: "asc"
        }
    });
    const entities = programs.map(programEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.program,
    programEntity.prismaSelection,
    programEntity.build,
    "Program not found"
);

router.get("/programs/:id", get);

router.get(
    "/programs",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(programId: number) {
    return `/programs/${programId}`;
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
