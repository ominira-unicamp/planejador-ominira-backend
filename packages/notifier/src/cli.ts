#!/usr/bin/env node
import { trace } from "@opentelemetry/api";
import {
    shutdownTelemetry,
    withoutPrismaTracing,
    withTrace
} from "@pomi/api-core";
import {
    claimNextJob,
    createDatabaseClient,
    enqueueJob,
    finishJob,
    JobRequestTrigger,
    JobRequestType
} from "@pomi/db";
import dotenv from "dotenv";
import { resolve } from "node:path";
import pino from "pino";

import { loadNotifierConfig } from "#/Config.js";
import { ExchangeNoticeNotifier } from "#/modules/exchange/ExchangeNoticeNotifier.js";

const controller = new AbortController();

function loadNotifierEnv() {
    dotenv.config({
        path: resolve(import.meta.dirname, "../../../.env")
    });
}

for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => controller.abort());

async function main() {
    loadNotifierEnv();
    if (process.argv[2] === "request") {
        const database = createDatabaseClient(process.env.DATABASE_URL ?? "", {
            max: 1
        });
        const job = await withTrace(
            "notifier.job.request",
            () =>
                enqueueJob(database, {
                    type: JobRequestType.NOTIFIER,
                    name: "notifier-cycle",
                    trigger: JobRequestTrigger.MANUAL,
                    requestedBy: process.env.POMI_JOB_REQUESTED_BY ?? "cli"
                }),
            { attributes: { "notifier.job.name": "notifier-cycle" } }
        )();
        process.stdout.write(`${job.id}\n`);
        await database.$disconnect();
        await shutdownTelemetry();
        return;
    }
    if (process.argv[2] === "job-status") {
        const database = createDatabaseClient(process.env.DATABASE_URL ?? "", {
            max: 1
        });
        const job = await database.jobRequest.findUnique({
            where: { id: process.argv[3] }
        });
        if (!job) throw new Error("Job não encontrado");
        process.stdout.write(`${JSON.stringify(job)}\n`);
        await database.$disconnect();
        await shutdownTelemetry();
        return;
    }
    const config = loadNotifierConfig(process.env);
    const logger = pino({ level: config.logLevel, mixin: traceContext });
    const database = createDatabaseClient(config.databaseUrl, { max: 2 });
    const notifier = new ExchangeNoticeNotifier(database, config, logger);
    let nextScheduledAt = 0;
    while (!controller.signal.aborted) {
        try {
            const now = Date.now();
            if (now >= nextScheduledAt) {
                nextScheduledAt = now + config.intervalMs;
                try {
                    await enqueueJob(database, {
                        type: JobRequestType.NOTIFIER,
                        name: "notifier-cycle",
                        trigger: JobRequestTrigger.SCHEDULED,
                        scheduledFor: new Date(now),
                        requestedBy: "scheduler",
                        deduplicationKey: `notifier:${now}`
                    });
                } catch (error) {
                    logger.debug(
                        { err: error },
                        "Ciclo do notifier já está pendente."
                    );
                }
            }
            const job = await withoutPrismaTracing(() =>
                claimNextJob(database, JobRequestType.NOTIFIER)
            );
            if (job) {
                try {
                    await notifier.run();
                    await finishJob(database, job.id, {});
                } catch (error) {
                    await finishJob(database, job.id, {
                        errorMessage:
                            error instanceof Error
                                ? error.message
                                : String(error)
                    });
                    throw error;
                }
            }
        } catch (error) {
            logger.error({ err: error }, "Ciclo de notificações falhou.");
        }
        await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, config.pollIntervalMs);
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

function traceContext() {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext || /^0+$/.test(spanContext.traceId)) return {};
    return { trace_id: spanContext.traceId };
}
