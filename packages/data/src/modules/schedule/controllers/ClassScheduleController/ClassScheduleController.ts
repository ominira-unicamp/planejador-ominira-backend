import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import IO, {
    type ListQueryParams
} from "#/modules/schedule/contracts/ClassScheduleInterface.js";
import { classScheduleProblemDetails } from "#/modules/schedule/problems/ClassScheduleProblems.js";
import { buildPaginationResponse } from "@pomi/api-core";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/class-schedules");
authRegistry.addException("GET", "/class-schedules/:id");

const listFn: HandlerFn<typeof IO.list> = async (ctx, input) => {
    const result = await ctx.classScheduleService.list(input.query);
    return {
        200: buildPaginationResponse(
            result.items,
            result.total,
            input.query,
            (page) => listPath({ ...input.query, page })
        )
    };
};

const getFn: HandlerFn<typeof IO.get> = async (ctx, input) => {
    const result = await ctx.classScheduleService.getById(input.path.id);
    return result.isOk()
        ? { 200: result.value }
        : { 404: classScheduleProblemDetails(result.error) };
};

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const result = await ctx.classScheduleService.create(input.body);
    if (result.isOk()) return { 201: result.value };
    const problem = classScheduleProblemDetails(result.error, "body");
    return { [problem.status]: problem };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const result = await ctx.classScheduleService.patch(
        input.path.id,
        input.body
    );
    if (result.isOk()) return { 200: result.value };
    const problem = classScheduleProblemDetails(result.error, "body");
    return { [problem.status]: problem };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const result = await ctx.classScheduleService.remove(input.path.id);
    if (result.isOk()) return { 204: null };
    const problem = classScheduleProblemDetails(result.error);
    return { [problem.status]: problem };
};

router.get(
    "/class-schedules",
    buildHandler(IO.list.request, IO.list.response, listFn)
);
router.get(
    "/class-schedules/:id",
    buildHandler(IO.get.request, IO.get.response, getFn)
);
router.post(
    "/class-schedules",
    buildHandler(IO.create.request, IO.create.response, createFn)
);
router.patch(
    "/class-schedules/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);
router.delete(
    "/class-schedules/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function listPath({
    unitId,
    courseId,
    studyPeriodId,
    classId,
    page,
    pageSize
}: ListQueryParams) {
    return (
        `/class-schedules?` +
        [
            unitId ? "unitId=" + unitId : undefined,
            courseId ? "courseId=" + courseId : undefined,
            studyPeriodId ? "studyPeriodId=" + studyPeriodId : undefined,
            classId ? "classId=" + classId : undefined,
            page ? "page=" + page : undefined,
            pageSize ? "pageSize=" + pageSize : undefined
        ]
            .filter(Boolean)
            .join("&")
    );
}

function entityPath(id: number) {
    return `/class-schedules/${id}`;
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
    paths: { list: listPath, entity: entityPath }
};
