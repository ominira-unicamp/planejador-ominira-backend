import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/catalog/catalog/Catalog.contract.js";
import catalogEntity from "#/modules/catalog/catalog/Catalog.entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/catalogs/:id");
authRegistry.addException("GET", "/catalogs");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const { query } = input;
    const catalogs = await ctx.prisma.catalog.findMany({
        ...catalogEntity.prismaSelection,
        where: {
            ...(query?.year && { year: query.year })
        },
        orderBy: {
            year: "desc"
        }
    });
    const entities = catalogs.map(catalogEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.catalog,
    catalogEntity.prismaSelection,
    catalogEntity.build,
    "Catalog not found"
);

router.get("/catalogs/:id", get);

router.get(
    "/catalogs",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(catalogId: number) {
    return `/catalogs/${catalogId}`;
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
