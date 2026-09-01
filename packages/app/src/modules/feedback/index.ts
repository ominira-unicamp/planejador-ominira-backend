import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import feedbackReport from "#/modules/feedback/feedback-report/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [feedbackReport];

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
