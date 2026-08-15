import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler, defaultListHandler } from "#/defaultEndpoint.js";
import IO, {
    ListQueryParams,
    professorPaths
} from "#/modules/academic/professor/Professor.contract.js";

extendZodWithOpenApi(z);

function withPaths(professor: { id: number; name: string }) {
    return {
        ...professor,
        _paths: {
            entity: professorPaths.entity(professor.id)
        }
    };
}

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/professors");
authRegistry.addException("GET", "/professors/:id");

const list = defaultListHandler(
    (p) => p.professor,
    IO.list.request.shape.query,
    (query) =>
        query.classId ? { classes: { some: { id: query.classId } } } : {},
    listPath,
    {},
    withPaths
);

router.get("/professors", list);

const get = defaultGetHandler(
    (p) => p.professor,
    {},
    withPaths,
    "Professor not found"
);

router.get("/professors/:id", get);

function listPath({ classId, page, pageSize }: ListQueryParams) {
    return (
        `/professors?` +
        [
            classId ? "classId=" + classId : undefined,
            page ? "page=" + page : undefined,
            pageSize ? "pageSize=" + pageSize : undefined
        ]
            .filter(Boolean)
            .join("&")
    );
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
        list: listPath,
        entity: professorPaths.entity
    }
};
