import {
    forbiddenProblem,
    sendProblem,
    unauthenticatedProblem
} from "@pomi/api-core";
import { asValue } from "awilix";
import { NextFunction, Request, Response } from "express";
import * as jose from "jose";
import { match } from "path-to-regexp";

import {
    AuthRoles,
    policies,
    type AuthorizationPolicy,
    type AuthRole,
    type Capability
} from "#/Authorization.js";

export * from "#/Authorization.js";

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

export type Principal = {
    authUserId: number;
    issuer: string;
    subject: string;
    email: string | null;
    roles: Set<AuthRole>;
    capabilities: Set<Capability>;
    studentId: number | null;
};

type TokenPayload = jose.JWTPayload & {
    email?: string;
    email_verified?: boolean;
    name?: string;
};

async function verifyAccessToken(token: string): Promise<TokenPayload> {
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

    return payload as TokenPayload;
}

function studentIdentityFromToken(payload: TokenPayload) {
    const email = payload.email?.trim().toLowerCase();
    // Desativado tepmorariamente verificacao de email
    // if (!payload.email_verified || !email) return undefined;
    if (!email) return undefined;
    const match = /^([a-z])([0-9]{6})@dac\.unicamp\.br$/i.exec(email);
    if (!match) return undefined;
    return { email, ra: match[2], displayName: payload.name };
}

async function resolvePrincipal(payload: TokenPayload, req: Request) {
    const tokenIssuer = payload.iss;
    const subject = payload.sub;
    if (!tokenIssuer || !subject) throw new ForbiddenError();

    let authUser = await req.prisma.authUser.findUnique({
        where: { issuer_subject: { issuer: tokenIssuer, subject } },
        include: {
            roles: true,
            capabilities: true
        }
    });

    if (!authUser) {
        const studentIdentity = studentIdentityFromToken(payload);
        if (!studentIdentity) throw new ForbiddenError();
        authUser = await req.prisma.authUser.create({
            data: {
                issuer: tokenIssuer,
                subject,
                email: studentIdentity.email,
                displayName: studentIdentity.displayName,
                roles: { create: { role: AuthRoles.STUDENT } }
            },
            include: {
                roles: true,
                capabilities: true
            }
        });
    }

    const studentIdentity = studentIdentityFromToken(payload);
    if (
        authUser.studentId === null &&
        authUser.roles.some((entry) => entry.role === AuthRoles.STUDENT) &&
        studentIdentity
    ) {
        const student = await req.prisma.student.findUnique({
            where: { ra: studentIdentity.ra },
            select: { id: true }
        });
        if (student) {
            await req.prisma.authUser.update({
                where: { id: authUser.id },
                data: { studentId: student.id }
            });
            authUser.studentId = student.id;
        }
    }

    if (authUser.status === "DISABLED") throw new ForbiddenError();

    return {
        authUserId: authUser.id,
        issuer: authUser.issuer,
        subject: authUser.subject,
        email: authUser.email,
        roles: new Set(authUser.roles.map((entry) => entry.role as AuthRole)),
        capabilities: new Set(
            authUser.capabilities.map((entry) => entry.capability as Capability)
        ),
        studentId: authUser.studentId
    } satisfies Principal;
}

type Methods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type Rule = {
    method: Methods;
    path: string;
    policy: AuthorizationPolicy;
};

export class ForbiddenError extends Error {
    constructor() {
        super("Forbidden");
    }
}

class AuthRegistry {
    rules: Rule[] = [];
    constructor(authRegistries: AuthRegistry[] = []) {
        for (const registry of authRegistries) {
            this.rules.push(...registry.rules);
        }
    }

    add(method: Methods, path: string, policy: AuthorizationPolicy) {
        this.rules.push({ method, path, policy });
    }

    addException(method: Methods, path: string) {
        this.add(method, path, policies.public);
    }

    addPolicy(method: Methods, path: string, policy: AuthorizationPolicy) {
        this.add(method, path, policy);
    }

    findRule(method: Methods, path: string) {
        for (const rule of this.rules) {
            if (rule.method !== method) continue;
            const fn = match(rule.path, { decode: decodeURIComponent });
            const result = fn(path);
            if (result) return { rule, params: result.params };
        }
        return undefined;
    }

    checkException(method: Methods, path: string): boolean {
        return this.findRule(method, path)?.rule.policy.kind === "public";
    }

    private async authorize(
        principal: Principal | undefined,
        policy: AuthorizationPolicy,
        params: Partial<Record<string, string | string[]>>,
        req: Request
    ) {
        if (policy.kind === "public" || disabled) return;
        if (!principal) throw new ForbiddenError();
        if (policy.kind === "authenticated") return;
        if (policy.kind === "admin") {
            if (principal.roles.has(AuthRoles.ADMIN)) return;
            throw new ForbiddenError();
        }
        if (policy.kind === "capability") {
            if (
                principal.roles.has(AuthRoles.ADMIN) ||
                principal.capabilities.has(policy.capability)
            )
                return;
            throw new ForbiddenError();
        }
        if (policy.kind === "student-registration") {
            if (
                principal.roles.has(AuthRoles.STUDENT) &&
                principal.studentId === null
            )
                return;
            throw new ForbiddenError();
        }

        const rawStudentId = params[policy.studentParam];
        const studentId = Number(
            Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId
        );
        if (!Number.isSafeInteger(studentId)) throw new ForbiddenError();
        if (principal.roles.has(AuthRoles.ADMIN)) return;
        if (principal.studentId === studentId) return;
        if (!principal.roles.has(AuthRoles.BOT)) throw new ForbiddenError();

        const grant = await req.prisma.botGrant.findFirst({
            where: {
                studentId,
                botAuthUserId: principal.authUserId,
                capability: policy.capability,
                revokedAt: null
            },
            select: { id: true }
        });
        if (!grant) throw new ForbiddenError();
    }

    middleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const ruleMatch = this.findRule(req.method as Methods, req.path);
            const policy = ruleMatch?.rule.policy ?? policies.authenticated;
            if (disabled || policy.kind === "public") return next();

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return sendProblem(res, unauthenticatedProblem(req.path));
            }

            let payload: TokenPayload;
            try {
                payload = await verifyAccessToken(authHeader.substring(7));
            } catch {
                return sendProblem(res, unauthenticatedProblem(req.path));
            }

            try {
                const principal = await resolvePrincipal(payload, req);
                req.user = payload;
                req.principal = principal;
                req.scope.register({ principal: asValue(principal) });
                await this.authorize(
                    principal,
                    policy,
                    ruleMatch?.params ?? {},
                    req
                );
                return next();
            } catch (error) {
                if (error instanceof ForbiddenError) {
                    return sendProblem(res, forbiddenProblem(req.path));
                }
                return next(error);
            }
        };
    }
}

export { AuthRegistry, verifyAccessToken };
