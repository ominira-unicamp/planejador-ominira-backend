import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import tagging from "#/modules/tagging/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [tagging];
export default {
    router: Router().use(tagging.router!),
    registry: new OpenAPIRegistry([tagging.registry!]),
    authRegistry: new AuthRegistry([tagging.authRegistry!]),
    controllers
} satisfies ModuleDefinition;
