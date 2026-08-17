import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import catalogCourse from "#/modules/catalog/catalog-course/index.js";
import catalogProgram from "#/modules/catalog/catalog-program/index.js";
import catalog from "#/modules/catalog/catalog/index.js";
import coordinator from "#/modules/catalog/coordinator/index.js";
import curriculumSuggestion from "#/modules/catalog/curriculum-suggestion/index.js";
import language from "#/modules/catalog/language/index.js";
import program from "#/modules/catalog/program/index.js";
import specialization from "#/modules/catalog/specialization/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    catalog,
    catalogCourse,
    coordinator,
    catalogProgram,
    curriculumSuggestion,
    language,
    program,
    specialization
];

const authRegistry = new AuthRegistry(
    controllers
        .filter((controller) => controller.authRegistry)
        .map((controller) => controller.authRegistry!)
);

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
