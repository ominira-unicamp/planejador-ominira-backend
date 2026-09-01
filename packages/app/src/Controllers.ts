import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
    isCompatibilityContract,
    pathSegmentToExpressPath
} from "@pomi/api-core";
import { Router } from "express";

import { AuthRegistry, type AuthorizationPolicy } from "#/auth.js";
import feedback from "#/modules/feedback/index.js";
import identity from "#/modules/identity/index.js";
import type { ControllerDefinition } from "#/modules/Module.js";
import planning from "#/modules/planning/index.js";
import social from "#/modules/social/index.js";

const modules = [identity, planning, social, feedback];
const controllers: ControllerDefinition[] = modules.flatMap(
    (module) => module.controllers
);

const contractAuthRegistry = new AuthRegistry();
for (const controller of controllers) {
    for (const contract of Object.values(controller.contracts ?? {})) {
        if (!isCompatibilityContract(contract)) continue;
        contractAuthRegistry.addPolicy(
            contract.meta.method.toUpperCase() as
                | "GET"
                | "POST"
                | "PUT"
                | "PATCH"
                | "DELETE",
            pathSegmentToExpressPath(contract.meta.path),
            contract.meta.authorization as AuthorizationPolicy
        );
    }
}

export const appControllers = {
    router: Router().use(modules.map((module) => module.router)),
    registry: new OpenAPIRegistry(
        controllers
            .filter((controller) => controller.registry)
            .map((controller) => controller.registry!)
    ),
    authRegistry: new AuthRegistry([
        identity.authRegistry,
        contractAuthRegistry
    ]),
    all: controllers
};

export default appControllers;
