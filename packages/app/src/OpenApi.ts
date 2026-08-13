import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { apiReference } from "@scalar/express-api-reference";
import type { Request, Response } from "express";
import { Router } from "express";

import { appControllers } from "#/Controllers.js";

function expressPath(path: string) {
    return path.replace(/\/:([\w-]+)/g, "/{$1}");
}

function policyFor(
    definition: (typeof appControllers.registry.definitions)[number]
) {
    if (definition.type !== "route") return "authenticated" as const;
    return (
        appControllers.authRegistry.rules.find(
            (rule) =>
                rule.method.toLowerCase() === definition.route.method &&
                expressPath(rule.path) === definition.route.path
        )?.policy.kind ?? "authenticated"
    );
}

function studentVisible(policy: ReturnType<typeof policyFor>) {
    return [
        "public",
        "authenticated",
        "student-access",
        "student-registration"
    ].includes(policy);
}

export function generateAppOpenApiDocument(audience: "student" | "all") {
    const definitions =
        audience === "all"
            ? appControllers.registry.definitions
            : appControllers.registry.definitions.filter((definition) =>
                  studentVisible(policyFor(definition))
              );
    const document = new OpenApiGeneratorV3(definitions).generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "POMI App API",
            description: "Personal and authenticated POMI features"
        },
        servers: [{ url: "", description: "POMI App" }]
    });
    document.components ??= {};
    document.components.securitySchemes ??= {};
    document.components.securitySchemes.BearerAuth = {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
    };
    for (const item of Object.values(document.paths)) {
        for (const operation of Object.values(item ?? {})) {
            if (
                !operation ||
                typeof operation !== "object" ||
                !("responses" in operation)
            )
                continue;
            operation.security ??= [{ BearerAuth: [] }];
        }
    }
    return document;
}

const router = Router();
router.get("/student-openapi.json", (_req: Request, res: Response) =>
    res.json(generateAppOpenApiDocument("student"))
);
router.get("/openapi.json", (_req: Request, res: Response) =>
    res.json(generateAppOpenApiDocument("all"))
);
router.use("/student-docs", apiReference({ url: "/student-openapi.json" }));
router.use("/docs", apiReference({ url: "/openapi.json" }));

export default router;
