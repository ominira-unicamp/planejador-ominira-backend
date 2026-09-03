#!/usr/bin/env node
import { shutdownTelemetry } from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";
import pino from "pino";

import { loadNotifierConfig } from "#/Config.js";
import { ExchangeNoticeNotifier } from "#/modules/exchange/ExchangeNoticeNotifier.js";

const config = loadNotifierConfig(process.env);
const logger = pino({ level: config.logLevel });
const database = createDatabaseClient(config.databaseUrl, { max: 2 });
const notifier = new ExchangeNoticeNotifier(database, config, logger);
const controller = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => controller.abort());

async function main() {
    while (!controller.signal.aborted) {
        try {
            await notifier.run();
        } catch (error) {
            logger.error({ err: error }, "Ciclo de notificações falhou.");
        }
        await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, config.intervalMs);
            controller.signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                { once: true }
            );
        });
    }
    try {
        await database.$disconnect();
    } finally {
        await shutdownTelemetry();
    }
}

void main();
