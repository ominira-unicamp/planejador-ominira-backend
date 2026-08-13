import { AuthRegistry } from "#/auth.js";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";

export type ControllerDefinition = {
    router?: Router;
    registry?: OpenAPIRegistry;
    authRegistry?: AuthRegistry;
};

export type ModuleDefinition = {
    router: Router;
    registry: OpenAPIRegistry;
    authRegistry: AuthRegistry;
    controllers: ControllerDefinition[];
};
