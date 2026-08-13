import { AuthRegistry, policies } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import identity from "#/modules/identity/controllers/IdentityController/IdentityController.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [identity];
const authRegistry = new AuthRegistry();
authRegistry.addPolicy("GET", "/me", policies.authenticated);
authRegistry.addPolicy("GET", "/bots", policies.authenticated);
authRegistry.addPolicy("GET", "/me/bot-grants", policies.authenticated);
authRegistry.addPolicy(
    "PUT",
    "/me/bot-grants/:botAuthUserId",
    policies.authenticated
);
authRegistry.addPolicy("GET", "/admin/auth-users", policies.admin);
authRegistry.addPolicy("POST", "/admin/auth-users", policies.admin);
authRegistry.addPolicy("PATCH", "/admin/auth-users/:id", policies.admin);

export default {
    router: Router().use(
        controllers
            .filter((controller) => controller.router)
            .map((controller) => controller.router!)
    ),
    registry: new OpenAPIRegistry(),
    authRegistry,
    controllers
} satisfies ModuleDefinition;
