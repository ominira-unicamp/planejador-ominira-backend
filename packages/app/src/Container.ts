import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { RequestHandler } from "express";

import type { AppConfig } from "#/Config.js";
import { buildZodIds } from "#/PrismaValidator.js";
import type { Principal } from "#/auth.js";
import type { DatabaseClient } from "@pomi/db";

export type AppCradle = {
    config: AppConfig;
    prisma: DatabaseClient;
    principal: Principal | undefined;
    zodIds: ReturnType<typeof buildZodIds>;
};

export function createAppContainer(config: AppConfig, prisma: DatabaseClient) {
    return createContainer<AppCradle>({
        injectionMode: InjectionMode.CLASSIC
    }).register({
        config: asValue(config),
        prisma: asValue(prisma),
        principal: asValue(undefined),
        zodIds: asFunction(buildZodIds).scoped()
    });
}

export type AppContainer = ReturnType<typeof createAppContainer>;

export function appScopeMiddleware(container: AppContainer): RequestHandler {
    return (request, _response, next) => {
        const scope = container.createScope();
        request.scope = scope;
        request.prisma = scope.cradle.prisma;
        next();
    };
}
