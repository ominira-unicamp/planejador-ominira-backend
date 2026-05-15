import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { openApiArgsFromIO } from "../../BuildHandler.js";
import IO from "./Interface.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
    method: "post",
    path: "/login",
    tags: ["auth"],
    ...openApiArgsFromIO(IO.login)
});

registry.registerPath({
    method: "post",
    path: "/auth/google",
    tags: ["auth"],
    ...openApiArgsFromIO(IO.google)
});

registry.registerPath({
    method: "post",
    path: "/auth/keycloak",
    tags: ["auth"],
    summary: "Exchange Keycloak authorization code for access token",
    description:
        "Exchanges an authorization code obtained from Keycloak for an access token",
    ...openApiArgsFromIO(IO.keycloak)
});

registry.registerPath({
    method: "get",
    path: "/auth/keycloak/config",
    tags: ["auth"],
    summary: "Get Keycloak configuration",
    description:
        "Returns the Keycloak configuration needed for client-side authentication",
    ...openApiArgsFromIO(IO.keycloakConfig)
});

export default registry;
