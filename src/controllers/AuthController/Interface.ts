import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { OutputBuilder } from "../../BuildHandler.js";

extendZodWithOpenApi(z);

const loginResponse = z
    .object({
        accessToken: z
            .string()
            .describe(
                "JWT access token to be used in Authorization header as Bearer token"
            )
    })
    .openapi("LoginResponse");

const login = {
    input: z.object({}),
    output: new OutputBuilder()
        .ok(loginResponse, "Successful login response")
        .build()
};

const google = {
    input: z.object({
        body: z.object({ credential: z.string().describe("Google ID token") })
    }),
    output: new OutputBuilder()
        .ok(loginResponse, "Successful login response")
        .build()
};

const keycloak = {
    input: z.object({
        body: z.object({
            code: z.string().describe("Authorization code from Keycloak"),
            redirectUri: z
                .string()
                .url()
                .describe("Redirect URI used in the authorization request")
        })
    }),
    output: new OutputBuilder()
        .ok(loginResponse, "Successful login response")
        .unauthorized("Invalid or expired authorization code")
        .build()
};

const keycloakConfig = {
    input: z.object({}),
    output: new OutputBuilder()
        .ok(
            z
                .object({
                    url: z.string().url().describe("Keycloak server URL"),
                    realm: z.string().describe("Keycloak realm name"),
                    clientId: z.string().describe("Keycloak client ID")
                })
                .openapi("KeycloakConfig"),
            "Keycloak configuration for client-side authentication"
        )
        .build()
};

export default {
    login,
    google,
    keycloak,
    keycloakConfig
};
