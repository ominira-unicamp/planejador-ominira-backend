import type { AppConfig } from "#/Config.js";
import type { PrismaClient } from "@pomi/db";
import { jwtVerify } from "jose";

export type ExchangeNoticeUnsubscribeService = {
    unsubscribe(token: string): Promise<void>;
};

export function createExchangeNoticeUnsubscribeService({
    config,
    prisma
}: {
    config: AppConfig;
    prisma: PrismaClient;
}): ExchangeNoticeUnsubscribeService {
    return {
        async unsubscribe(token) {
            if (!config.notifierUnsubscribeSecret)
                throw new Error("Notifier unsubscribe is not configured");
            const { payload } = await jwtVerify(
                token,
                new TextEncoder().encode(config.notifierUnsubscribeSecret)
            );
            if (
                payload.action !== "exchange-notice-unsubscribe" ||
                typeof payload.sub !== "string" ||
                !/^[1-9][0-9]*$/.test(payload.sub)
            )
                throw new Error("Invalid unsubscribe token");
            await prisma.exchangeNoticeSubscription.updateMany({
                where: { studentId: Number(payload.sub) },
                data: { enabled: false }
            });
        }
    };
}
