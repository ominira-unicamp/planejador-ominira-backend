import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import studyPeriodEntity from "#/modules/schedule/study-period/StudyPeriod.entity.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/study-periods");
const listFn: HandlerFn<typeof IO.list> = async (ctx, _input) => {
    const studyPeriods = await ctx.prisma.studyPeriod.findMany();
    const entities = studyPeriods.map(studyPeriodEntity.build);
    return { 200: entities };
};

const get = defaultGetHandler(
    (p) => p.studyPeriod,
    {},
    studyPeriodEntity.build,
    "Study period not found"
);

router.get("/study-periods/:id", get);

router.get(
    "/study-periods",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

function entityPath(studyPeriodId: number) {
    return `/study-periods/${studyPeriodId}`;
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
