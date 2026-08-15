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
import { ValidationError } from "@pomi/api-core";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("GET", "/specializations/:id");
authRegistry.addException("GET", "/specializations");

function validationError(
    path: string[],
    code: "REFERENCE_NOT_FOUND" | "ALREADY_EXISTS",
    message: string
) {
    return new ValidationError([{ path, code, message }]);
}

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

export const createFn: HandlerFn<typeof IO.create> = async (ctx, input) => {
    const {
        body: { programId, code, name }
    } = input;

    const program = await ctx.prisma.program.findUnique({
        where: { id: programId },
        select: { id: true }
    });
    if (!program)
        return {
            400: validationError(
                ["body", "programId"],
                "REFERENCE_NOT_FOUND",
                `Program with id ${programId} not found`
            )
        };

    const duplicate = await ctx.prisma.specialization.findUnique({
        where: { programId_code: { programId, code } },
        select: { id: true }
    });
    if (duplicate)
        return {
            400: validationError(
                ["body", "code"],
                "ALREADY_EXISTS",
                `Specialization with code ${code} already exists for program ${programId}`
            )
        };

    const specialization = await ctx.prisma.specialization.create({
        ...specializationEntity.prismaSelection,
        data: {
            programId,
            code,
            name
        }
    });
    return { 201: specializationEntity.build(specialization) };
};

export const patchFn: HandlerFn<typeof IO.patch> = async (ctx, input) => {
    const {
        path: { id },
        body
    } = input;

    const existing = await ctx.prisma.specialization.findUnique({
        where: { id }
    });

    if (!existing) {
        return { 404: { description: "Specialization not found" } };
    }

    if (body.code) {
        const duplicate = await ctx.prisma.specialization.findUnique({
            where: {
                programId_code: {
                    programId: existing.programId,
                    code: body.code
                }
            },
            select: { id: true }
        });
        if (duplicate && duplicate.id !== id)
            return {
                400: validationError(
                    ["body", "code"],
                    "ALREADY_EXISTS",
                    `Specialization with code ${body.code} already exists for program ${existing.programId}`
                )
            };
    }

    const specialization = await ctx.prisma.specialization.update({
        ...specializationEntity.prismaSelection,
        where: { id },
        data: body
    });

    return { 200: specializationEntity.build(specialization) };
};

const removeFn: HandlerFn<typeof IO.remove> = async (ctx, input) => {
    const {
        path: { id }
    } = input;

    const existing = await ctx.prisma.specialization.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    catalogSpecializations: true,
                    students: true
                }
            }
        }
    });

    if (!existing) {
        return { 404: { description: "Specialization not found" } };
    }

    if (
        existing._count.catalogSpecializations > 0 ||
        existing._count.students > 0
    ) {
        const error = new ValidationError();
        error.addError({
            path: ["path", "id"],
            code: "REFERENCE_EXISTS",
            message: `Cannot delete specialization with ${existing._count.students} students and ${existing._count.catalogSpecializations} catalog specializations`
        });
        return { 400: error };
    }

    await ctx.prisma.specialization.delete({ where: { id } });
    return { 204: null };
};

router.get("/specializations/:id", get);

router.get(
    "/specializations",
    buildHandler(IO.list.request, IO.list.response, listFn)
);

router.post(
    "/specializations",
    buildHandler(IO.create.request, IO.create.response, createFn)
);

router.patch(
    "/specializations/:id",
    buildHandler(IO.patch.request, IO.patch.response, patchFn)
);

router.delete(
    "/specializations/:id",
    buildHandler(IO.remove.request, IO.remove.response, removeFn)
);

function entityPath(specializationId: number) {
    return `/specializations/${specializationId}`;
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
        entity: entityPath
    }
};
