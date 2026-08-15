import { AuthRoles, type Principal, type StudentCapability } from "#/auth.js";
import IO from "#/modules/identity/bot-grant/BotGrant.contract.js";
import { botNotFoundProblem } from "#/modules/identity/bot-grant/BotGrant.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type BotGrant = z.infer<typeof IO.schemas.entity>;

export type BotGrantService = {
    listBots(): Promise<Array<{ id: number; displayName: string | null }>>;
    list(principal: Principal): Promise<BotGrant[]>;
    replace(
        principal: Principal,
        botAuthUserId: number,
        capabilities: StudentCapability[]
    ): Promise<Result<void, ReturnType<typeof botNotFoundProblem>>>;
};

export function createBotGrantService({
    prisma
}: {
    prisma: PrismaClient;
}): BotGrantService {
    return {
        listBots: () =>
            prisma.authUser.findMany({
                where: {
                    status: "ACTIVE",
                    roles: { some: { role: AuthRoles.BOT } }
                },
                select: { id: true, displayName: true }
            }),
        async list(principal) {
            if (principal.studentId === null) return [];
            return await prisma.botGrant.findMany({
                where: { studentId: principal.studentId },
                include: {
                    botAuthUser: { select: { id: true, displayName: true } }
                },
                orderBy: { createdAt: "desc" }
            });
        },
        async replace(principal, botAuthUserId, requested) {
            if (principal.studentId === null) return err(botNotFoundProblem());
            const bot = await prisma.authUser.findFirst({
                where: {
                    id: botAuthUserId,
                    status: "ACTIVE",
                    roles: { some: { role: AuthRoles.BOT } }
                },
                select: { id: true }
            });
            if (!bot) return err(botNotFoundProblem());
            const capabilities = [...new Set(requested)];
            await prisma.$transaction(async (tx) => {
                await tx.botGrant.updateMany({
                    where: {
                        studentId: principal.studentId!,
                        botAuthUserId: bot.id,
                        revokedAt: null,
                        ...(capabilities.length
                            ? { capability: { notIn: capabilities } }
                            : {})
                    },
                    data: {
                        revokedAt: new Date(),
                        revokedByAuthUserId: principal.authUserId
                    }
                });
                const active = new Set(
                    (
                        await tx.botGrant.findMany({
                            where: {
                                studentId: principal.studentId!,
                                botAuthUserId: bot.id,
                                revokedAt: null
                            },
                            select: { capability: true }
                        })
                    ).map(({ capability }) => capability)
                );
                const missing = capabilities.filter(
                    (capability) => !active.has(capability)
                );
                if (missing.length)
                    await tx.botGrant.createMany({
                        data: missing.map((capability) => ({
                            studentId: principal.studentId!,
                            botAuthUserId: bot.id,
                            capability,
                            grantedByAuthUserId: principal.authUserId
                        }))
                    });
            });
            return ok(undefined);
        }
    };
}
