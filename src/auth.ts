import { NextFunction, Request, Response } from "express";
import * as jose from "jose";
import { match } from "path-to-regexp";

const disabled = process.env.DISABLED_AUTH === "true";
const isProduction = process.env.NODE_ENV === "production";
const issuer = process.env.KEYCLOAK_ISSUER?.replace(/\/$/, "");
const audience = process.env.KEYCLOAK_AUDIENCE;

if (isProduction && disabled) {
    throw new Error("DISABLED_AUTH cannot be enabled in production.");
}

if ((!issuer || !audience) && !disabled) {
    throw new Error(
        "KEYCLOAK_ISSUER and KEYCLOAK_AUDIENCE are required when authentication is enabled."
    );
}

const keySet = issuer
    ? jose.createRemoteJWKSet(
          new URL(`${issuer}/protocol/openid-connect/certs`)
      )
    : undefined;

async function verifyAccessToken(token: string): Promise<jose.JWTPayload> {
    if (!keySet || !issuer || !audience) {
        throw new Error("Authentication is not configured.");
    }

    const { payload } = await jose.jwtVerify(token, keySet, {
        issuer,
        audience,
        algorithms: ["RS256"]
    });

    if (!payload.sub) {
        throw new Error("The access token has no subject.");
    }

    return payload;
}

type Methods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type ExceptionType = {
    method: Methods;
    path: string;
};
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
            if (disabled) {
                return next();
            }
            const authHeader = req.headers.authorization;
            if (this.checkException(req.method as Methods, req.path)) {
                return next();
            }
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            try {
                const payload = await verifyAccessToken(
                    authHeader.substring(7)
                );
                req.user = payload;
                next();
            } catch {
                return res.status(401).json({ error: "Unauthorized" });
            }
        };
    }
}

export { AuthRegistry, verifyAccessToken };
