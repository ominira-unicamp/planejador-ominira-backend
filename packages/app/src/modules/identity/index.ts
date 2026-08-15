import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import authUser from "#/modules/identity/auth-user/index.js";
import botGrant from "#/modules/identity/bot-grant/index.js";
import currentUser from "#/modules/identity/current-user/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    currentUser,
    botGrant,
    authUser
];

export default {
    router: Router().use(
        controllers
            .filter((controller) => controller.router)
            .map((controller) => controller.router!)
    ),
    registry: new OpenAPIRegistry(),
    authRegistry: new AuthRegistry(
        controllers
            .filter((controller) => controller.authRegistry)
            .map((controller) => controller.authRegistry!)
    ),
    controllers
} satisfies ModuleDefinition;
