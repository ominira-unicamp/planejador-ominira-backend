import { NextFunction, Request, Response } from "express";
import * as jose from "jose";
import { match } from "path-to-regexp";

const disabled = process.env.DISABLED_AUTH === "true";

// Keycloak configuration
const keycloakUrl = process.env.KEYCLOAK_URL;
const keycloakRealm = process.env.KEYCLOAK_REALM || "pomi";
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || "pomi-backend";

// JWKS for Keycloak token validation
let keycloakJWKS: jose.JWTVerifyGetKey | null = null;

function getKeycloakJWKS(): jose.JWTVerifyGetKey {
    if (!keycloakJWKS) {
        if (!keycloakUrl) {
            throw new Error(
                "KEYCLOAK_URL environment variable is required when authentication is enabled."
            );
        }
        const jwksUrl = new URL(
            `/realms/${keycloakRealm}/protocol/openid-connect/certs`,
            keycloakUrl
        );
        keycloakJWKS = jose.createRemoteJWKSet(jwksUrl);
    }
    return keycloakJWKS;
}

// Fallback to local JWT for development/testing
const secretKey = process.env.secretKey;
const secret = secretKey ? new TextEncoder().encode(secretKey) : null;
const alg = "HS256";

async function generateToken(
    payload: { userId: number; [key: string]: unknown },
    expiresIn: string = "2h"
): Promise<string> {
    if (!secret) {
        throw new Error("secretKey is required to generate local tokens");
    }
    const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg })
        .setSubject(String(payload.userId))
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
    return jwt;
}

type Methods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type ExceptionType = {
    method: Methods;
    path: string;
};

async function tryGetUser(
    req: Request
): Promise<{ id: number; email?: string } | undefined> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return undefined;
    }

    const token = authHeader.substring(7);

    // Try Keycloak token validation first (if configured)
    if (keycloakUrl) {
        try {
            const jwks = getKeycloakJWKS();
            const { payload } = await jose.jwtVerify(token, jwks, {
                issuer: `${keycloakUrl}/realms/${keycloakRealm}`,
                audience: keycloakClientId
            });

            // Extract user info from Keycloak token
            const email = payload.email as string | undefined;
            const userId = payload.userId as number | undefined;

            if (email || userId) {
                return {
                    id: userId || 0, // Will be resolved by middleware if needed
                    email
                };
            }
        } catch (_keycloakError) {
            // Fall through to try local token validation
        }
    }

    // Fallback to local JWT validation
    if (secret) {
        try {
            const { payload } = await jose.jwtVerify(token, secret);
            let userId: number | undefined;
            if (payload && typeof payload.sub !== "undefined") {
                userId = parseInt(String(payload.sub));
            } else if ((payload as { userId?: unknown })?.userId) {
                userId = Number(payload.userId);
            }
            if (!userId || Number.isNaN(userId)) {
                return undefined;
            }
            return { id: userId };
        } catch (_error) {
            return undefined;
        }
    }

    return undefined;
}
class AuthRegistry {
    exceptions: ExceptionType[] = [];
    constructor(authRegistries: AuthRegistry[] = []) {
        for (const registry of authRegistries) {
            this.exceptions.push(...registry.exceptions);
        }
    }

    addException(method: Methods, path: string) {
        this.exceptions.push({ method, path });
    }
    checkException(method: Methods, path: string): boolean {
        for (const exception of this.exceptions) {
            if (exception.method === method) {
                const fn = match(exception.path, {
                    decode: decodeURIComponent
                });
                const result = fn(path);
                if (result) return true;
            }
        }
        return false;
    }
    middleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            req.user = await tryGetUser(req);

            if (disabled) return next();

            if (this.checkException(req.method as Methods, req.path))
                return next();

            if (!req.user)
                return res.status(401).json({ error: "Unauthorized" });
            next();
        };
    }
}

export { AuthRegistry, generateToken };
