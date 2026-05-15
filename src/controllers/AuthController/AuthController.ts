import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";
import z from "zod";
import { AuthRegistry, generateToken } from "../../auth.js";
import { buildHandler, Context } from "../../BuildHandler.js";
import IO from "./Interface.js";
import registry from "./OpenAPI.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

// Keycloak configuration
const keycloakUrl = process.env.KEYCLOAK_URL;
const keycloakRealm = process.env.KEYCLOAK_REALM || "pomi";
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || "pomi-backend";
const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

authRegistry.addException("POST", "/login");
authRegistry.addException("POST", "/auth/google");
authRegistry.addException("POST", "/auth/keycloak");
authRegistry.addException("GET", "/auth/keycloak/config");

async function googleFn(
    ctx: Context,
    input: z.infer<typeof IO.google.input>
): Promise<z.infer<typeof IO.google.output>> {
    const token = input.body.credential;
    const jwks = createRemoteJWKSet(
        new URL("https://www.googleapis.com/oauth2/v3/certs")
    );
    try {
        const verifyOptions: JWTVerifyOptions = {};
        if (process.env.GOOGLE_CLIENT_ID)
            verifyOptions.audience = process.env.GOOGLE_CLIENT_ID;
        const { payload } = await jwtVerify(token, jwks, verifyOptions);

        const email = payload.email as string | undefined;
        const name =
            (payload.name as string | undefined) ||
            (email ? email.split("@")[0] : "GoogleUser");

        if (!email) return { 401: "Invalid token: no email" };
        const prisma = ctx.prisma;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email, name } });
        }
        const accessToken = await generateToken({ userId: user.id });
        return { 200: { accessToken } };
    } catch (_err) {
        return { 401: "Invalid token" };
    }
}

async function keycloakFn(
    ctx: Context,
    input: z.infer<typeof IO.keycloak.input>
): Promise<z.infer<typeof IO.keycloak.output>> {
    const { code, redirectUri } = input.body;

    if (!keycloakUrl) {
        return { 401: "Keycloak is not configured" };
    }

    try {
        // Exchange authorization code for tokens
        const tokenEndpoint = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`;

        const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: keycloakClientId,
            code,
            redirect_uri: redirectUri
        });

        if (keycloakClientSecret) {
            tokenParams.append("client_secret", keycloakClientSecret);
        }

        const tokenResponse = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: tokenParams.toString()
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Keycloak token exchange failed:", errorText);
            return { 401: "Invalid authorization code" };
        }

        const tokenData = (await tokenResponse.json()) as {
            access_token: string;
            id_token?: string;
            refresh_token?: string;
        };

        // Verify the access token
        const jwksUrl = new URL(
            `/realms/${keycloakRealm}/protocol/openid-connect/certs`,
            keycloakUrl
        );
        const jwks = createRemoteJWKSet(jwksUrl);

        const { payload } = await jwtVerify(tokenData.access_token, jwks, {
            issuer: `${keycloakUrl}/realms/${keycloakRealm}`
        });

        const email = payload.email as string | undefined;
        const name =
            (payload.name as string | undefined) ||
            (payload.preferred_username as string | undefined) ||
            (email ? email.split("@")[0] : "KeycloakUser");

        if (!email) {
            return { 401: "Invalid token: no email" };
        }

        const prisma = ctx.prisma;

        // Find or create user by email
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || "Keycloak User"
                }
            });
        }

        const accessToken = await generateToken({ userId: user.id });
        return { 200: { accessToken } };
    } catch (err) {
        console.error("Keycloak authentication error:", err);
        return { 401: "Authentication failed" };
    }
}

async function keycloakConfigFn(
    _ctx: Context,
    _input: z.infer<typeof IO.keycloakConfig.input>
): Promise<z.infer<typeof IO.keycloakConfig.output>> {
    if (!keycloakUrl) {
        return { 401: "Keycloak is not configured" };
    }

    return {
        200: {
            url: keycloakUrl,
            realm: keycloakRealm,
            clientId: keycloakClientId
        }
    };
}

router.post(
    "/auth/google",
    buildHandler(IO.google.input, IO.google.output, googleFn)
);

router.post(
    "/auth/keycloak",
    buildHandler(IO.keycloak.input, IO.keycloak.output, keycloakFn)
);

router.get(
    "/auth/keycloak/config",
    buildHandler(
        IO.keycloakConfig.input,
        IO.keycloakConfig.output,
        keycloakConfigFn
    )
);

export default {
    router,
    registry,
    authRegistry,
    paths: {
        login: () => "/login",
        google: () => "/auth/google",
        keycloak: () => "/auth/keycloak",
        keycloakConfig: () => "/auth/keycloak/config"
    }
};
