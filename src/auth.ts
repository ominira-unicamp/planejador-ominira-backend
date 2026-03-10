import { NextFunction, Request, Response } from "express";
import * as jose from "jose";
import { match } from "path-to-regexp";

const disabled = process.env.DISABLED_AUTH === "true";
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.secretKey && !disabled) {
    throw new Error(
        "secretKey environment variable is required when authentication is enabled. Set DISABLED_AUTH=true for development or provide a secretKey."
    );
}

const secretKey = process.env.secretKey ?? "default";

// In production, enforce minimum secret key length
if (isProduction && !disabled && secretKey.length < 32) {
    throw new Error(
        "secretKey must be at least 32 characters in production environment."
    );
}

const secret = new TextEncoder().encode(secretKey);
const alg = "HS256";

async function generateToken(
    payload: { userId: number; [key: string]: unknown },
    expiresIn: string = "2h"
): Promise<string> {
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

async function tryGetUser(req: Request): Promise<{ id: number } | undefined> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return undefined;
    }
    try {
        const { payload } = await jose.jwtVerify(
            authHeader.substring(7),
            secret
        );
        let userId: number | undefined;
        if (payload && typeof payload.sub !== "undefined") {
            userId = parseInt(String(payload.sub));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if ((payload as any)?.userId) {
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
