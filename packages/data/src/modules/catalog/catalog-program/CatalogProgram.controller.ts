import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO from "#/modules/catalog/catalog-program/CatalogProgram.contract.js";
import { catalogProgramProblemDetails } from "#/modules/catalog/catalog-program/CatalogProgram.problems.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/catalog-program");
authRegistry.addException("GET", "/catalog-program/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const {
        query: { catalogId, programId, programCode }
    } = input;
    return {
        200: await ctx.catalogProgramService.list({
            catalogId,
            programId,
            programCode
        })
    };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const result = await ctx.catalogProgramService.getById(input.path.id);
    return result.isOk()
        ? { 200: result.value }
        : { 404: catalogProgramProblemDetails(result.error) };
};

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const result = await ctx.catalogProgramService.create(input.body);
    if (result.isOk()) return { 201: result.value };
    const problem = catalogProgramProblemDetails(result.error, {
        inputLocation: "body"
    });
    return { [problem.status]: problem };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const result = await ctx.catalogProgramService.patch(
        input.path.id,
        input.body
    );
    if (result.isOk()) return { 200: result.value };
    const problem = catalogProgramProblemDetails(result.error, {
        inputLocation: "body"
    });
    return { [problem.status]: problem };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const result = await ctx.catalogProgramService.remove(input.path.id);
    if (result.isOk()) return { 204: null };
    const problem = catalogProgramProblemDetails(result.error);
    return { [problem.status]: problem };
};

router.get(
    "/catalog-program",
    buildHandler(IO.list.request, IO.list.response, listFn)
);
router.get(
    "/catalog-program/:id",
    buildHandler(IO.get.request, IO.get.response, getFn)
);
router.post(
    "/catalog-program/:id",
    buildHandler(IO.create.request, IO.create.response, createFn)
);
router.patch(
    "/catalog-program/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);
router.delete(
    "/catalog-program/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function entityPath(programId: number) {
    return `/catalog-program/${programId}`;
}

function listPath() {
    return "/catalog-programs";
}

const registry = new OpenAPIRegistry();

registry.registerPath(openApiArgsFromIO(IO.get));
registry.registerPath(openApiArgsFromIO(IO.list));
registry.registerPath(openApiArgsFromIO(IO.create));
registry.registerPath(openApiArgsFromIO(IO.patch));
registry.registerPath(openApiArgsFromIO(IO.remove));

export default {
    contracts: IO,
    router,
    registry,
    authRegistry,
    paths: {
        entity: entityPath,
        list: listPath
    }
};
