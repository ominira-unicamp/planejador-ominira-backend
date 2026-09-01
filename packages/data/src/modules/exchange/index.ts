import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import exchangeNotice from "#/modules/exchange/exchange-notice/index.js";
import exchangePlace from "#/modules/exchange/exchange-place/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    exchangeNotice,
    exchangePlace
];

export default {
    router: Router().use(
        controllers
            .filter((controller) => controller.router)
            .map((controller) => controller.router!)
    ),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
            .flat()
    ),
    authRegistry: new AuthRegistry(
        controllers
            .filter((controller) => controller.authRegistry)
            .map((controller) => controller.authRegistry!)
    ),
    controllers
} satisfies ModuleDefinition;
