import { AuthRegistry, Capabilities, policies } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import course from "#/modules/academic/course/index.js";
import professor from "#/modules/academic/professor/index.js";
import room from "#/modules/academic/room/index.js";
import unit from "#/modules/academic/unit/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [
    unit,
    course,
    professor,
    room
];

const resources = ["/courses", "/professors", "/rooms", "/units"];
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
