import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";

import { AuthRegistry } from "#/auth.js";
import { buildHandler, HandlerFn, openApiArgsFromIO } from "#/BuildHandler.js";
import { defaultGetHandler } from "#/defaultEndpoint.js";
import IO from "#/modules/schedule/contracts/StudyPeriodsInterface.js";
import studyPeriodEntity from "#/modules/schedule/controllers/StudyPeriodsController/Entity.js";
import { ValidationError } from "@pomi/api-core";

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

const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const { body } = input;
    const existing = await ctx.prisma.studyPeriod.findFirst({
        where: { code: body.code }
    });
    if (existing) {
        return {
            400: new ValidationError([
                {
                    code: "ALREADY_EXISTS",
                    path: ["body", "code"],
                    message: "A study period with this code already exists"
                }
            ])
        };
    }
    const studyPeriod = await ctx.prisma.studyPeriod.create({
        data: {
            code: body.code,
            startDate: body.startDate
        }
    });
    return { 201: studyPeriodEntity.build(studyPeriod) };
};

const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;
    const existing = await ctx.prisma.studyPeriod.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Study period not found" } };

    const studyPeriod = await ctx.prisma.studyPeriod.update({
        where: { id },
        data: {
            ...(body.code !== undefined && { code: body.code }),
            ...(body.startDate !== undefined && { startDate: body.startDate })
        }
    });
    return { 200: studyPeriodEntity.build(studyPeriod) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;
    const existing = await ctx.prisma.studyPeriod.findUnique({ where: { id } });
    if (!existing) return { 404: { description: "Study period not found" } };
    await ctx.prisma.studyPeriod.delete({ where: { id } });
    return { 204: null };
};

router.get("/study-periods/:id", get);

router.get(
    "/study-periods",
    buildHandler(IO.list.input, IO.list.output, listFn)
);

router.post(
    "/study-periods",
    buildHandler(IO.create.input, IO.create.output, createFn)
);

router.patch(
    "/study-periods/:id",
    buildHandler(IO.patch.input, IO.patch.output, patchFn)
);

router.delete(
    "/study-periods/:id",
    buildHandler(IO.remove.input, IO.remove.output, removeFn)
);

function entityPath(studyPeriodId: number) {
    return `/study-periods/${studyPeriodId}`;
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
