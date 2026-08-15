import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/catalog/language/Language.contract.js";
import languageEntity from "#/modules/catalog/language/Language.entity.js";
extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/languages/:id");
authRegistry.addException("GET", "/languages");

const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const languages = await ctx.prisma.language.findMany({
        ...languageEntity.prismaSelection,
        orderBy: {
            name: "asc"
        }
    });
    const entities = languages.map(languageEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.language,
    languageEntity.prismaSelection,
    languageEntity.build,
    "Language not found"
);

router.get("/languages/:id", get);

router.get(
    "/languages",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(languageId: number) {
    return `/languages/${languageId}`;
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
