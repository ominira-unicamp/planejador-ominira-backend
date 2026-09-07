import { AuthRegistry } from "#/auth.js";
import type { ModuleDefinition } from "#/modules/Module.js";
import studentTagInterest from "#/modules/student-tag-interest/index.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

const controllers: ModuleDefinition["controllers"] = [studentTagInterest];

export default {
    router: Router().use(studentTagInterest.router!),
    registry: new OpenAPIRegistry([studentTagInterest.registry!]),
    authRegistry: new AuthRegistry([studentTagInterest.authRegistry!]),
    controllers
} satisfies ModuleDefinition;
