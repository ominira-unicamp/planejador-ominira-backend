#!/usr/bin/env node
import { Command } from "commander";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pino from "pino";
import { loadInjectionConfig } from "./config.js";
import { injectionNames } from "./registry.js";
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
    .command("run <name>")
    .description(`executa uma injection (${injectionNames.join(", ")})`)
    .action(async (name: string) => {
        const config = await loadInjectionConfig(program.opts().config);
        const injection = config.injections.find((item) => item.name === name);
        if (!injection) throw new Error(`Injection não encontrada: ${name}`);
        await runInjection(config, injection);
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
                    await runInjection(config, injection, controller.signal);
                } catch (error) {
                    cliLogger.error(
                        { err: error, event: "injection.run.issue" },
                        "Falha na execução da injection"
                    );
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
    } finally {
        await rm(lockDirectory, { recursive: true, force: true });
    }
});

program.parseAsync().catch((error: unknown) => {
    cliLogger.error(
        { err: error, event: "injection.cli.error" },
        "Falha ao executar o CLI"
    );
    process.exitCode = 1;
});
