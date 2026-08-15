import { AuthRegistry } from "#/auth.js";
import { openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler, defaultListHandler } from "#/defaultEndpoint.js";
import IO, {
    ListQueryParams
} from "#/modules/schedule/class/Class.contract.js";
import classEntity from "#/modules/schedule/class/Class.entity.js";
import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { whereIdCode, whereIdName } from "@pomi/db";
import { Router } from "express";
import z from "zod";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/classes");
authRegistry.addException("GET", "/classes/:id");

const list = defaultListHandler(
    (p) => p.class,
    IO.list.request.shape.query,
    (query) => ({
        ...(query.classCode
            ? {
                  code: {
                      contains: query.classCode,
                      mode: "insensitive" as const
                  }
              }
            : {}),
        course: {
            ...whereIdCode(query.courseId, query.courseCode),
            unit: whereIdCode(query.unitId, query.unitCode)
        },
        studyPeriod: whereIdCode(query.studyPeriodId, query.studyPeriodCode),
        ...(query.professorId || query.professorName
            ? {
                  professors: {
                      some: {
                          ...whereIdName(query.professorId, query.professorName)
                      }
                  }
              }
            : {})
    }),
    listPath,
    classEntity.prismaSelection,
    classEntity.build
);

router.get("/classes", list);

const get = defaultGetHandler(
    (p) => p.class,
    classEntity.prismaSelection,
    classEntity.build,
    "Class not found"
);

router.get("/classes/:id", get);

function listPath(query: ListQueryParams) {
    return (
        `/classes?` +
        [
            query.unitId ? "unitId=" + query.unitId : undefined,
            query.courseId ? "courseId=" + query.courseId : undefined,
            query.studyPeriodId
                ? "studyPeriodId=" + query.studyPeriodId
                : undefined,
            query.professorId ? "professorId=" + query.professorId : undefined,
            query.page ? "page=" + query.page : undefined,
            query.pageSize ? "pageSize=" + query.pageSize : undefined
        ]
            .filter(Boolean)
            .join("&")
    );
}

function entityPath(id: number) {
    return `/classes/${id}`;
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
        entity: entityPath
    }
};
