import pino, { type Logger } from "pino";

export type InjectionChange = {
    entity: string;
    operation: "create" | "update";
    key: Record<string, string | number>;
    changedFields?: string[];
};

export type InjectionLogger = Logger & {
    change(change: InjectionChange): void;
};

export function createInjectionLogger(injection: string, runId: string) {
    const logger = pino({
        level: process.env.POMI_INJECTION_LOG_LEVEL ?? "info"
    }).child({
        component: "pomi-injection",
        injection,
        runId
    }) as InjectionLogger;
    logger.change = (change) =>
        logger.info(
            { event: "pomi.injection.change", ...change },
            "Registro alterado"
        );
    return logger;
}
