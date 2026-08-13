import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { apiReference } from "@scalar/express-api-reference";
import type { Request, Response } from "express";
import { Router } from "express";

import { dataControllers } from "#/Controllers.js";

function expressPath(path: string) {
    return path.replace(/\/:([\w-]+)/g, "/{$1}");
}

function isPublicRoute(
    definition: (typeof dataControllers.registry.definitions)[number]
) {
    if (definition.type !== "route") return true;
    return dataControllers.authRegistry.rules.some(
        (rule) =>
            rule.policy.kind === "public" &&
            rule.method.toLowerCase() === definition.route.method &&
            expressPath(rule.path) === definition.route.path
    );
}

export function generateDataOpenApiDocument(audience: "public" | "all") {
    const definitions =
        audience === "all"
            ? dataControllers.registry.definitions
            : dataControllers.registry.definitions.filter(isPublicRoute);
    const document = new OpenApiGeneratorV3(definitions).generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "POMI Data API",
            description: "Public university data normalized by POMI"
        },
        servers: [{ url: "", description: "POMI Data" }]
    });
    document.components ??= {};
    document.components.securitySchemes ??= {};
    document.components.securitySchemes.DataAdminToken = {
        type: "http",
        scheme: "bearer",
        description: "POMI Data administration service token"
    };
    if (audience === "all") {
        for (const item of Object.values(document.paths)) {
            for (const [method, operation] of Object.entries(item ?? {})) {
                if (
                    !operation ||
                    typeof operation !== "object" ||
                    !("responses" in operation)
                )
                    continue;
                if (["post", "patch", "put", "delete"].includes(method)) {
                    operation.security ??= [{ DataAdminToken: [] }];
                }
            }
        }
    }
    return document;
}

const router = Router();
router.get("/public-openapi.json", (_req: Request, res: Response) =>
    res.json(generateDataOpenApiDocument("public"))
);
router.get("/openapi.json", (_req: Request, res: Response) =>
    res.json(generateDataOpenApiDocument("all"))
);
router.use("/public-docs", apiReference({ url: "/public-openapi.json" }));
router.use("/docs", apiReference({ url: "/openapi.json" }));

export default router;
