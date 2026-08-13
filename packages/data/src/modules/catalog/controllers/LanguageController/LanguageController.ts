import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/catalog/contracts/LanguageInterface.js";
import languageEntity from "#/modules/catalog/controllers/LanguageController/Entity.js";
import { ValidationError } from "@pomi/api-core";
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

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const {
        body: { name }
    } = input;

    const language = await ctx.prisma.language.create({
        ...languageEntity.prismaSelection,
        data: {
            name
        }
    });
    return { 201: languageEntity.build(language) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body: { name }
    } = input;

    const existing = await ctx.prisma.language.findUnique({
        where: { id }
    });

    if (!existing) {
        return { 404: { description: "Language not found" } };
    }

    const language = await ctx.prisma.language.update({
        ...languageEntity.prismaSelection,
        where: { id },
        data: { name }
    });

    return { 200: languageEntity.build(language) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.language.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    catalogLanguages: true
                }
            }
        }
    });

    if (!existing) {
        return { 404: { description: "Language not found" } };
    }

    if (existing._count.catalogLanguages > 0) {
        const error = new ValidationError();
        error.addError({
            path: ["path", "id"],
            code: "REFERENCE_EXISTS",
            message: `Cannot delete language with ${existing._count.catalogLanguages} catalog languages`
        });
        return { 400: error };
    }

    await ctx.prisma.language.delete({ where: { id } });
    return { 204: null };
};

router.get("/languages/:id", get);

router.get("/languages", buildHandler(IO.list.input, IO.list.output, listFn));

router.post(
    "/languages",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/languages/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/languages/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(languageId: number) {
    return `/languages/${languageId}`;
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
        entity: entityPath
    }
};
