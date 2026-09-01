import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import exchangeNoticeSubscription from "#/modules/exchange/exchange-notice-subscription/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    exchangeNoticeSubscription
];

export default {
    router: Router().use(controllers.map((controller) => controller.router!)),
    registry: new OpenAPIRegistry(
        controllers.map((controller) => controller.registry!).flat()
    ),
    authRegistry: new AuthRegistry(
        controllers.map((controller) => controller.authRegistry!)
    ),
    controllers
} satisfies ModuleDefinition;
