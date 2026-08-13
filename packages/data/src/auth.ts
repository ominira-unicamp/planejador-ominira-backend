import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import { match } from "path-to-regexp";

export const Capabilities = {
    ACADEMIC_WRITE: "ACADEMIC_WRITE"
} as const;
export type Principal = never;

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type Policy = { kind: "public" } | { kind: "data-admin" };
type Rule = { method: Method; path: string; policy: Policy };

export const policies = {
    public: { kind: "public" } as const,
    capability: (_capability: string): Policy => ({ kind: "data-admin" })
};

function validServiceToken(value: string, expected: string) {
    const actualBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return (
        actualBuffer.length === expectedBuffer.length &&
        timingSafeEqual(actualBuffer, expectedBuffer)
    );
}

export class AuthRegistry {
    rules: Rule[] = [];

    constructor(registries: AuthRegistry[] = []) {
        for (const registry of registries) this.rules.push(...registry.rules);
    }

    addPolicy(method: Method, path: string, policy: Policy) {
        this.rules.push({ method, path, policy });
    }

    addException(method: Method, path: string) {
        this.addPolicy(method, path, policies.public);
    }

    findRule(method: Method, path: string) {
        return this.rules.find(
            (rule) =>
                rule.method === method &&
                Boolean(match(rule.path, { decode: decodeURIComponent })(path))
        );
    }

    checkException(method: Method, path: string) {
        return this.findRule(method, path)?.policy.kind === "public";
    }

    middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            const policy =
                this.findRule(req.method as Method, req.path)?.policy ??
                ({ kind: "data-admin" } as const);
            if (policy.kind === "public") return next();

            const expected = process.env.POMI_DATA_ADMIN_TOKEN;
            if (!expected) {
                return res
                    .status(503)
                    .json({ error: "Data administration disabled" });
            }
            const authorization = req.headers.authorization;
            if (!authorization?.startsWith("Bearer ")) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            return validServiceToken(authorization.slice(7), expected)
                ? next()
                : res.status(401).json({ error: "Unauthorized" });
        };
    }
}
