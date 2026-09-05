import { withTrace } from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";
import { randomUUID } from "node:crypto";
import {
    access,
    mkdir,
    readFile,
    rename,
    rm,
    writeFile
} from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { InjectionAuditContext } from "./audit-context.js";
import {
    interpolate,
    isPathInside,
    resolveCommandCwd,
    resolveInputPath,
    type InjectionConfig,
    type InjectionDefinition
} from "./config.js";
import { loadInjectionEnv } from "./env.js";
import { createInjectionLogger } from "./logger.js";
import { runProcess } from "./process.js";
import { createInjectionService, type InjectionService } from "./registry.js";

export type InjectionRunMode = "all" | "obtain" | "inject";
export type InjectionRunContext = Pick<
    InjectionAuditContext,
    "jobId" | "trigger" | "requestedBy"
>;

export async function runInjection(
    config: InjectionConfig,
    definition: InjectionDefinition,
    signal?: AbortSignal,
    serviceFactory: (
        definition: InjectionDefinition
    ) => InjectionService = createInjectionService,
    mode: InjectionRunMode = "all",
    parameters: Record<string, unknown> = {},
    executionContext: InjectionRunContext = {}
) {
    if (!(["all", "obtain", "inject"] as InjectionRunMode[]).includes(mode))
        throw new Error(`Modo de execução inválido: ${mode}`);
    return withTrace(
        "injection.run",
        () =>
            runInjectionInternal(
                config,
                definition,
                signal,
                serviceFactory,
                mode,
                parameters,
                executionContext
            ),
        {
            attributes: {
                "injection.name": definition.name,
                "injection.mode": mode
            }
        }
    )();
}

async function runInjectionInternal(
    config: InjectionConfig,
    definition: InjectionDefinition,
    signal?: AbortSignal,
    serviceFactory: (
        definition: InjectionDefinition
    ) => InjectionService = createInjectionService,
    mode: InjectionRunMode = "all",
    parameters: Record<string, unknown> = {},
    executionContext: InjectionRunContext = {}
) {
    loadInjectionEnv();
    if (mode !== "obtain" && !process.env.DATABASE_URL)
        throw new Error(
            "DATABASE_URL deve ser configurada para executar a injection"
        );
    const databaseUrl = process.env.DATABASE_URL;
    const runId = randomUUID();
    const logger = createInjectionLogger(definition.name, runId);
    const baseInputPath = resolveInputPath(
        definition,
        config.rootDirectory,
        config.configDirectory
    );
    const inputPath = partitionInputPath(
        baseInputPath,
        parameters.partitionKey
    );
    const temporaryPath = `${inputPath}.${runId}.partial`;
    const variables: Record<string, string> = {
        POMI_INJECTION_NAME: definition.name,
        POMI_INJECTION_RUN_ID: runId,
        POMI_INJECTION_OUTPUT: temporaryPath,
        POMI_INJECTION_INPUT: inputPath,
        POMI_CURRENT_YEAR: String(new Date().getFullYear()),
        POMI_CURRENT_SEMESTER: new Date().getMonth() < 6 ? "1" : "2"
    };
    for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === "string" || typeof value === "number")
            variables[
                `POMI_PARTITION_${key.replaceAll("-", "_").toUpperCase()}`
            ] = String(value);
    }
    if (!isPathInside(config.rootDirectory, inputPath))
        throw new Error(`Arquivo de entrada fora da raiz: ${inputPath}`);
    await mkdir(dirname(inputPath), { recursive: true });
    try {
        if (mode !== "inject") {
            const scraperRunId = randomUUID();
            logger.info(
                {
                    event: "injection.process.started",
                    scraperRunId,
                    command: definition.obtain.command
                },
                "Processo do scrapper iniciado"
            );
            try {
                const processResult = await withTrace(
                    "injection.obtain",
                    () =>
                        runProcess(
                            {
                                command: definition.obtain.command,
                                args: partitionArgs(
                                    definition.obtain.args,
                                    parameters
                                ).map((value) => interpolate(value, variables)),
                                cwd: resolveCommandCwd(
                                    config.rootDirectory,
                                    config.configDirectory,
                                    definition.obtain.cwd
                                ),
                                env: {
                                    ...variables,
                                    POMI_SCRAPER_RUN_ID: scraperRunId,
                                    OTEL_SERVICE_NAME: "unicamp-scrapper",
                                    ...Object.fromEntries(
                                        Object.entries(
                                            definition.obtain.env
                                        ).map(([key, value]) => [
                                            key,
                                            interpolate(value, variables)
                                        ])
                                    )
                                },
                                timeoutMs: definition.obtain.timeoutMs,
                                stderrToStdout: true,
                                allowedExitCodes: definition.allowIssues
                                    ? [1]
                                    : undefined
                            },
                            signal
                        ),
                    {
                        attributes: {
                            "injection.name": definition.name,
                            "injection.scraper_run_id": scraperRunId
                        }
                    }
                )();
                logger.info(
                    {
                        event: "injection.process.completed",
                        scraperRunId,
                        ...processResult
                    },
                    "Processo do scrapper concluído"
                );
            } catch (error) {
                const event =
                    error instanceof Error && error.message.includes("timeout")
                        ? "injection.process.timeout"
                        : signal?.aborted
                          ? "injection.process.cancelled"
                          : "injection.process.failed";
                logger.error(
                    {
                        event,
                        scraperRunId,
                        err: error
                    },
                    "Processo do scrapper falhou"
                );
                throw error;
            }
            await access(temporaryPath);
            await rename(temporaryPath, inputPath);
            logger.info({ inputPath }, "Obtenção concluída");
        } else {
            await access(inputPath);
            logger.info({ inputPath }, "Usando arquivo existente para injeção");
        }
        if (mode === "obtain")
            return { name: definition.name, runId, inputPath, mode };
        const service = serviceFactory(definition);
        if (!databaseUrl)
            throw new Error(
                "DATABASE_URL deve ser configurada para executar a injection"
            );
        const prisma = createDatabaseClient(databaseUrl, { max: 1 });
        let persistenceError: unknown;
        try {
            try {
                await service.run({
                    prisma,
                    inputPath,
                    runId,
                    auditContext: {
                        source: "injection",
                        runId,
                        injectionName: definition.name,
                        mode: mode === "inject" ? "inject" : "all",
                        trigger: executionContext.trigger ?? "MANUAL",
                        requestedBy: executionContext.requestedBy ?? "cli",
                        ...(executionContext.jobId
                            ? { jobId: executionContext.jobId }
                            : {})
                    },
                    logger,
                    signal
                });
            } catch (error) {
                persistenceError = error;
                logger.error(
                    { err: error },
                    "Falha na persistência da injection"
                );
            }
        } finally {
            await prisma.$disconnect();
        }
        await writeInjectionIssuesFile({
            definition,
            inputPath,
            runId,
            error: persistenceError,
            logger
        });
        if (persistenceError) throw persistenceError;
        return { name: definition.name, runId, inputPath, mode };
    } finally {
        await rm(temporaryPath, { force: true });
    }
}

function partitionArgs(args: string[], parameters: Record<string, unknown>) {
    const firstYear = parameters.firstYear ?? parameters.first_year;
    const lastYear = parameters.lastYear ?? parameters.last_year;
    const instituteCode = parameters.instituteCode ?? parameters.institute_code;
    const result = args.map((value, index) => {
        const previous = args[index - 1];
        if (previous === "--first-year" && typeof firstYear === "number")
            return String(firstYear);
        if (previous === "--last-year" && typeof lastYear === "number")
            return String(lastYear);
        return value;
    });
    if (
        typeof instituteCode === "string" &&
        !result.includes("--institute-code")
    )
        return [...result, "--institute-code", instituteCode];
    return result;
}

function partitionInputPath(inputPath: string, partitionKey: unknown) {
    if (typeof partitionKey !== "string" || partitionKey.length === 0)
        return inputPath;
    const extension = extname(inputPath);
    const stem = basename(inputPath, extension);
    const safeKey = partitionKey.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return join(dirname(inputPath), `${stem}.${safeKey}${extension}`);
}

async function writeInjectionIssuesFile({
    definition,
    inputPath,
    runId,
    error,
    logger
}: {
    definition: InjectionDefinition;
    inputPath: string;
    runId: string;
    error: unknown;
    logger: ReturnType<typeof createInjectionLogger>;
}) {
    const issuesPath = `${inputPath}.issues.json`;
    try {
        const input = JSON.parse(await readFile(inputPath, "utf8")) as {
            issues?: unknown;
        };
        const report = {
            injection: definition.name,
            runId,
            generatedAt: new Date().toISOString(),
            inputPath,
            issues: Array.isArray(input.issues) ? input.issues : [],
            error: error ? serializeError(error) : null
        };
        await writeFile(
            issuesPath,
            `${JSON.stringify(report, null, 2)}\n`,
            "utf8"
        );
        logger.info(
            { issuesPath, issues: report.issues.length },
            "Relatório de issues gravado"
        );
    } catch (reportError) {
        logger.warn(
            { err: reportError, issuesPath },
            "Não foi possível gravar o relatório de issues"
        );
    }
}

function serializeError(error: unknown) {
    if (error instanceof Error)
        return { name: error.name, message: error.message, stack: error.stack };
    return { message: String(error) };
}

export async function runAll(config: InjectionConfig, signal?: AbortSignal) {
    for (const definition of config.injections) {
        await runInjection(config, definition, signal);
    }
}
