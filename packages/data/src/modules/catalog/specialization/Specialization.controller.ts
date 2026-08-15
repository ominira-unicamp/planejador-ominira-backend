import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/catalog/specialization/Specialization.contract.js";
import specializationEntity from "#/modules/catalog/specialization/Specialization.entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/specializations/:id");
authRegistry.addException("GET", "/specializations");

export const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { programId, programCode, code } = input.query;
    const specializations = await ctx.prisma.specialization.findMany({
        ...specializationEntity.prismaSelection,
        where: {
            program: {
                id: programId,
                code: programCode
            },
            code
        },
        orderBy: [{ program: { code: "asc" } }, { name: "asc" }]
    });
    const entities = specializations.map(specializationEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.specialization,
    specializationEntity.prismaSelection,
    specializationEntity.build,
    "Specialization not found"
);

router.get("/specializations/:id", get);

router.get(
    "/specializations",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(specializationId: number) {
    return `/specializations/${specializationId}`;
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
