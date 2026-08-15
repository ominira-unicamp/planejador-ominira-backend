import { AuthRegistry, Capabilities, policies } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import catalogProgram from "#/modules/catalog/catalog-program/index.js";
import catalog from "#/modules/catalog/catalog/index.js";
import curriculumSuggestion from "#/modules/catalog/curriculum-suggestion/index.js";
import language from "#/modules/catalog/language/index.js";
import program from "#/modules/catalog/program/index.js";
import specialization from "#/modules/catalog/specialization/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    catalog,
    catalogProgram,
    curriculumSuggestion,
    language,
    program,
    specialization
];

const resources = [
    "/catalogs",
    "/catalog-program",
    "/curriculum-suggestions",
    "/languages",
    "/programs",
    "/specializations"
];
const authRegistry = new AuthRegistry(
    controllers
        .filter((controller) => controller.authRegistry)
        .map((controller) => controller.authRegistry!)
);

for (const path of resources) {
    authRegistry.addPolicy(
        "POST",
        path,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "PATCH",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
    authRegistry.addPolicy(
        "DELETE",
        `${path}/:id`,
        policies.capability(Capabilities.ACADEMIC_WRITE)
    );
}

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
    authRegistry,
    controllers
} satisfies ModuleDefinition;
