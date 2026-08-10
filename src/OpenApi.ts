import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { apiReference } from "@scalar/express-api-reference";
import type { Request, Response } from "express";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import Controlellers from "./Controllers.js";

type DocumentationAudience = "public" | "student" | "all";

function convertExpressToOpenAPI(path: string): string {
    return path.replace(/\/:([\w-]+)/g, "/{$1}");
}

const router = Router();
const registry = Controlellers.registry;

registry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Keycloak access token using the Bearer scheme"
});

registry.definitions.forEach((r) => {
    if (r.type == "route") {
        const rule = Controlellers.authRegistry.rules.find(
            (candidate) =>
                r.route.method.toUpperCase() === candidate.method &&
                r.route.path === convertExpressToOpenAPI(candidate.path)
        );
        if (rule?.policy.kind === "public") return;
        r.route.security = [{ BearerAuth: [] }];
        r.route.responses["401"] = {
            description: "Unauthorized - Missing or invalid JWT token"
        };
        r.route.responses["403"] = {
            description: "Forbidden - Insufficient authorization"
        };
    }
});

function routePolicy(definition: (typeof registry.definitions)[number]) {
    if (definition.type !== "route") return "authenticated" as const;
    const rule = Controlellers.authRegistry.rules.find(
        (candidate) =>
            definition.route.method.toUpperCase() === candidate.method &&
            definition.route.path === convertExpressToOpenAPI(candidate.path)
    );
    return rule?.policy.kind ?? "authenticated";
}

function includesAudience(
    audience: DocumentationAudience,
    policy: ReturnType<typeof routePolicy>
) {
    if (audience === "all") return true;
    if (audience === "public") return policy === "public";
    return (
        policy === "public" ||
        policy === "authenticated" ||
        policy === "student-access" ||
        policy === "student-registration"
    );
}

export function generateOpenApiDocument(audience: DocumentationAudience) {
    const definitions = registry.definitions.filter((definition) =>
        includesAudience(audience, routePolicy(definition))
    );
    const generator = new OpenApiGeneratorV3(definitions);
    return generator.generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "Pomi",
            description: "This is the API"
        },
        servers: [{ url: "", description: "POMI" }]
    });
}

router.get("/public-openapi.json", (_req: Request, res: Response) => {
    res.json(generateOpenApiDocument("public"));
});

router.get("/student-openapi.json", (_req: Request, res: Response) => {
    res.json(generateOpenApiDocument("student"));
});

router.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(generateOpenApiDocument("all"));
});

router.use(
    "/public-docs",
    apiReference({
        url: "/public-openapi.json"
    })
);

router.use(
    "/student-docs",
    apiReference({
        url: "/student-openapi.json"
    })
);

router.use(
    "/docs",
    apiReference({
        url: "/openapi.json"
    })
);

router.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
        swaggerOptions: {
            url: "/openapi.json",
            displayRequestDuration: true,
            tryItOutEnabled: true,
            persistAuthorization: true
        },
        customSiteTitle: "My API Docs"
    })
);

export default {
    router
};
