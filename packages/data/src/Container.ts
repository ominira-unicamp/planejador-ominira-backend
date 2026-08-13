import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { RequestHandler } from "express";

import type { DataConfig } from "#/Config.js";
import { buildZodIds } from "#/PrismaValidator.js";
import type { DatabaseClient } from "@pomi/db";

export type DataCradle = {
    config: DataConfig;
    prisma: DatabaseClient;
    zodIds: ReturnType<typeof buildZodIds>;
};

export function createDataContainer(
    config: DataConfig,
    prisma: DatabaseClient
) {
    return createContainer<DataCradle>({
        injectionMode: InjectionMode.CLASSIC
    }).register({
        config: asValue(config),
        prisma: asValue(prisma),
        zodIds: asFunction(buildZodIds).scoped()
    });
}

export type DataContainer = ReturnType<typeof createDataContainer>;

export function dataScopeMiddleware(container: DataContainer): RequestHandler {
    return (request, _response, next) => {
        const scope = container.createScope();
        request.scope = scope;
        request.prisma = scope.cradle.prisma;
        next();
    };
}
