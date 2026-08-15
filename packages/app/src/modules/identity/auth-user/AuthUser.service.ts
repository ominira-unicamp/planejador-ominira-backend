import { AuthRoles, type Capability, type Principal } from "#/auth.js";
import IO from "#/modules/identity/auth-user/AuthUser.contract.js";
import authUserEntity from "#/modules/identity/auth-user/AuthUser.entity.js";
import {
    adminIdentityManagedByCliProblem,
    authUserNotFoundProblem,
    type AuthUserProblem
} from "#/modules/identity/auth-user/AuthUser.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type AuthUser = z.infer<typeof IO.schemas.entity>;

type CreateInput = {
    subject: string;
    displayName: string;
    capabilities: Capability[];
};
type PatchInput = {
    status?: "ACTIVE" | "DISABLED";
    displayName?: string;
    capabilities?: Capability[];
};
export type AuthUserService = {
    list(): Promise<AuthUser[]>;
    create(principal: Principal, input: CreateInput): Promise<AuthUser>;
    patch(
        id: number,
        input: PatchInput
    ): Promise<Result<AuthUser, AuthUserProblem>>;
};
export function createAuthUserService({
    prisma
}: {
    prisma: PrismaClient;
}): AuthUserService {
    return {
        async list() {
            return (
                await prisma.authUser.findMany({
                    ...authUserEntity.prismaSelection,
                    orderBy: { id: "asc" }
                })
            ).map(authUserEntity.build);
        },
        async create(principal, input) {
            const authUser = await prisma.authUser.upsert({
                where: {
                    issuer_subject: {
                        issuer: principal.issuer,
                        subject: input.subject
                    }
                },
                create: {
                    issuer: principal.issuer,
                    subject: input.subject,
                    displayName: input.displayName,
                    roles: { create: { role: AuthRoles.BOT } },
                    capabilities: {
                        create: input.capabilities.map((capability) => ({
                            capability
                        }))
                    }
                },
                update: { displayName: input.displayName, status: "ACTIVE" },
                ...authUserEntity.prismaSelection
            });
            await prisma.authUserRole.upsert({
                where: {
                    authUserId_role: {
                        authUserId: authUser.id,
                        role: AuthRoles.BOT
                    }
                },
                create: { authUserId: authUser.id, role: AuthRoles.BOT },
                update: {}
            });
            return authUserEntity.build(authUser);
        },
        async patch(id, input) {
            const existing = await prisma.authUser.findUnique({
                where: { id },
                include: { roles: true }
            });
            if (!existing) return err(authUserNotFoundProblem());
            if (existing.roles.some((role) => role.role === AuthRoles.ADMIN))
                return err(adminIdentityManagedByCliProblem());
            const authUser = await prisma.$transaction(async (tx) => {
                if (input.capabilities) {
                    await tx.authUserCapability.deleteMany({
                        where: { authUserId: id }
                    });
                    await tx.authUserCapability.createMany({
                        data: input.capabilities.map((capability) => ({
                            authUserId: id,
                            capability
                        }))
                    });
                }
                return tx.authUser.update({
                    where: { id },
                    data: {
                        ...(input.status ? { status: input.status } : {}),
                        ...(input.displayName
                            ? { displayName: input.displayName }
                            : {})
                    },
                    ...authUserEntity.prismaSelection
                });
            });
            return ok(authUserEntity.build(authUser));
        }
    };
}
