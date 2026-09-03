#!/usr/bin/env node
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
import { Command } from "commander";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pino from "pino";
import { loadInjectionConfig } from "./config.js";
import { loadInjectionEnv } from "./env.js";
import { injectionNames } from "./registry.js";
import type { InjectionRunMode } from "./runner.js";
import { runInjection } from "./runner.js";

const program = new Command().name("pomi-injection").version("0.1.0");
const cliLogger = pino({
    level:
        process.env.LOG_LEVEL ?? process.env.POMI_INJECTION_LOG_LEVEL ?? "info"
});
program.addHelpText(
    "after",
    `\nInjections predefinidas:\n${injectionNames
        .map((name) => `  - ${name}`)
        .join("\n")}\n`
);
program.option(
    "--config <file>",
    "arquivo de configuração",
    process.env.POMI_INJECTION_CONFIG ??
        resolve(import.meta.dirname, "../injections.json")
);

program.command("list").action(async () => {
    const config = await loadInjectionConfig(program.opts().config);
    for (const injection of config.injections)
        process.stdout.write(
            `${injection.name}\t${injection.description ?? ""}\n`
        );
});

program.command("validate").action(async () => {
    const config = await loadInjectionConfig(program.opts().config);
    process.stdout.write(
        `${config.injections.length} injection(s) válida(s)\n`
    );
});

program
    .command("request <name> [mode]")
    .description("enfileira uma injection para execução pelo worker")
    .option("--first-year <year>", "primeiro ano da partição", parseYear)
    .option("--last-year <year>", "último ano da partição", parseYear)
    .option("--partition-key <key>", "identificador da partição")
    .action(async (name: string, mode = "all", command: Command) => {
        const options = command.opts<PartitionOptions>();
        loadInjectionEnv();
        const config = await loadInjectionConfig(program.opts().config);
        const injection = config.injections.find((item) => item.name === name);
        if (!injection) throw new Error(`Injection não encontrada: ${name}`);
        if (!(["all", "obtain", "inject"] as string[]).includes(mode))
            throw new Error(`Modo inválido: ${mode}`);
        const database = createDatabaseClient(process.env.DATABASE_URL ?? "", {
            max: 1
        });
        try {
            const job = await withTrace(
                "injection.job.request",
                () =>
                    enqueueJob(database, {
                        type: JobRequestType.INJECTION,
                        name,
                        mode: mode as "all" | "obtain" | "inject",
                        trigger: JobRequestTrigger.MANUAL,
                        partitionKey:
                            options.partitionKey ?? partitionKey(options),
                        parameters: partitionParameters(options),
                        requestedBy: process.env.POMI_JOB_REQUESTED_BY ?? "cli"
                    }),
                {
                    attributes: {
                        "injection.name": name,
                        "injection.mode": mode
                    }
                }
            )();
            process.stdout.write(`${job.id}\n`);
        } finally {
            await database.$disconnect();
        }
    });

program.command("job-status <id>").action(async (id: string) => {
    loadInjectionEnv();
    const database = createDatabaseClient(process.env.DATABASE_URL ?? "", {
        max: 1
    });
    try {
        const job = await database.jobRequest.findUnique({ where: { id } });
        if (!job) throw new Error("Job não encontrado");
        process.stdout.write(`${JSON.stringify(job)}\n`);
    } finally {
        await database.$disconnect();
    }
});

program
    .command("run <name> [mode]")
    .description(
        `executa uma injection (${injectionNames.join(", ")}); modo: all, obtain ou inject`
    )
    .action(async (name: string, mode = "all") => {
        if (!["all", "obtain", "inject"].includes(mode))
            throw new Error(
                `Modo inválido: ${mode}. Use all, obtain ou inject.`
            );
        const config = await loadInjectionConfig(program.opts().config);
        const injection = config.injections.find((item) => item.name === name);
        if (!injection) throw new Error(`Injection não encontrada: ${name}`);
        await runInjection(
            config,
            injection,
            undefined,
            undefined,
            mode as InjectionRunMode
        );
    });

program.command("watch").action(async () => {
    const config = await loadInjectionConfig(program.opts().config);
    const lockDirectory = join(
        config.rootDirectory,
        ".pomi-injection-watch.lock"
    );
    await mkdir(config.rootDirectory, { recursive: true });
    try {
        await mkdir(lockDirectory);
    } catch {
        throw new Error(`Já existe um watch ativo: ${lockDirectory}`);
    }
    await writeFile(join(lockDirectory, "pid"), `${process.pid}\n`);
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    loadInjectionEnv();
    const database = createDatabaseClient(process.env.DATABASE_URL ?? "", {
        max: 1
    });
    const nextRun = new Map(config.injections.map((item) => [item.name, 0]));
    try {
        while (!controller.signal.aborted) {
            const now = Date.now();
            for (const injection of config.injections) {
                if (
                    !injection.schedule ||
                    (nextRun.get(injection.name) ?? 0) > now
                )
                    continue;
                nextRun.set(
                    injection.name,
                    now + injection.schedule.intervalMs
                );
                try {
                    const partitions = injection.partitioning
                        ? Array.from(
                              {
                                  length:
                                      new Date().getFullYear() -
                                      injection.partitioning.firstYear +
                                      1
                              },
                              (_, index) =>
                                  injection.partitioning!.firstYear + index
                          )
                        : [undefined];
                    for (const year of partitions) {
                        try {
                            await enqueueJob(database, {
                                type: JobRequestType.INJECTION,
                                name: injection.name,
                                mode: "all",
                                trigger: JobRequestTrigger.SCHEDULED,
                                scheduledFor: new Date(now),
                                requestedBy: "scheduler",
                                partitionKey:
                                    year === undefined
                                        ? undefined
                                        : String(year),
                                parameters:
                                    year === undefined
                                        ? undefined
                                        : { firstYear: year, lastYear: year },
                                deduplicationKey:
                                    year === undefined
                                        ? `injection:${injection.name}:${now}`
                                        : `injection:${injection.name}:${year}:${now}`
                            });
                        } catch (error) {
                            cliLogger.debug(
                                { err: error, injection: injection.name, year },
                                "Partição já pendente"
                            );
                        }
                    }
                } catch (error) {
                    cliLogger.debug(
                        { err: error, injection: injection.name },
                        "Execução já pendente"
                    );
                }
            }
            const job = await withoutPrismaTracing(() =>
                claimNextJob(database, JobRequestType.INJECTION)
            );
            if (job) {
                const injection = config.injections.find(
                    (item) => item.name === job.name
                );
                if (!injection) {
                    await finishJob(database, job.id, {
                        errorMessage: `Injection não encontrada: ${job.name}`
                    });
                } else {
                    try {
                        const result = await runInjection(
                            config,
                            injection,
                            controller.signal,
                            undefined,
                            (job.mode ?? "all") as InjectionRunMode,
                            job.parameters && typeof job.parameters === "object"
                                ? (job.parameters as Record<string, unknown>)
                                : undefined
                        );
                        await finishJob(database, job.id, {
                            runId: result.runId
                        });
                    } catch (error) {
                        await finishJob(database, job.id, {
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                        });
                        cliLogger.error(
                            {
                                err: error,
                                jobId: job.id,
                                event: "injection.run.issue"
                            },
                            "Falha na execução da injection"
                        );
                    }
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 5_000));
        }
    } finally {
        await database.$disconnect();
        await rm(lockDirectory, { recursive: true, force: true });
    }
});

async function main() {
    try {
        await program.parseAsync();
    } catch (error) {
        cliLogger.error(
            { err: error, event: "injection.cli.error" },
            "Falha ao executar o CLI"
        );
        process.exitCode = 1;
    } finally {
        await shutdownTelemetry();
    }
}

void main();

type PartitionOptions = {
    firstYear?: number;
    lastYear?: number;
    partitionKey?: string;
};

function parseYear(value: string) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1900 || year > 3000)
        throw new Error("Ano inválido");
    return year;
}

function partitionParameters(options: PartitionOptions) {
    if (options.firstYear === undefined && options.lastYear === undefined)
        return undefined;
    const firstYear = options.firstYear ?? options.lastYear;
    const lastYear = options.lastYear ?? options.firstYear;
    return { firstYear, lastYear };
}

function partitionKey(options: PartitionOptions) {
    const parameters = partitionParameters(options);
    return parameters
        ? `${parameters.firstYear}-${parameters.lastYear}`
        : undefined;
}
