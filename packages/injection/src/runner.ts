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
import { dirname } from "node:path";
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

export async function runInjection(
    config: InjectionConfig,
    definition: InjectionDefinition,
    signal?: AbortSignal,
    serviceFactory: (
        definition: InjectionDefinition
    ) => InjectionService = createInjectionService
) {
    loadInjectionEnv();
    if (!process.env.DATABASE_URL)
        throw new Error(
            "DATABASE_URL deve ser configurada para executar a injection"
        );
    const runId = randomUUID();
    const logger = createInjectionLogger(definition.name, runId);
    const inputPath = resolveInputPath(
        definition,
        config.rootDirectory,
        config.configDirectory
    );
    const temporaryPath = `${inputPath}.${runId}.partial`;
    const variables = {
        POMI_INJECTION_NAME: definition.name,
        POMI_INJECTION_RUN_ID: runId,
        POMI_INJECTION_OUTPUT: temporaryPath,
        POMI_INJECTION_INPUT: inputPath,
        POMI_CURRENT_YEAR: String(new Date().getFullYear()),
        POMI_CURRENT_SEMESTER: new Date().getMonth() < 6 ? "1" : "2"
    };
    if (!isPathInside(config.rootDirectory, inputPath))
        throw new Error(`Arquivo de entrada fora da raiz: ${inputPath}`);
    await mkdir(dirname(inputPath), { recursive: true });
    try {
        await runProcess(
            {
                command: definition.obtain.command,
                args: definition.obtain.args.map((value) =>
                    interpolate(value, variables)
                ),
                cwd: resolveCommandCwd(
                    config.rootDirectory,
                    config.configDirectory,
                    definition.obtain.cwd
                ),
                env: {
                    ...variables,
                    ...Object.fromEntries(
                        Object.entries(definition.obtain.env).map(
                            ([key, value]) => [
                                key,
                                interpolate(value, variables)
                            ]
                        )
                    )
                },
                timeoutMs: definition.obtain.timeoutMs,
                stderrToStdout: true,
                allowedExitCodes: definition.allowIssues ? [1] : undefined
            },
            signal
        );
        await access(temporaryPath);
        await rename(temporaryPath, inputPath);
        const service = serviceFactory(definition);
        const prisma = createDatabaseClient(process.env.DATABASE_URL);
        let persistenceError: unknown;
        try {
            try {
                await service.run({ prisma, inputPath, runId, logger, signal });
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
        return { name: definition.name, runId, inputPath };
    } finally {
        await rm(temporaryPath, { force: true });
    }
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
