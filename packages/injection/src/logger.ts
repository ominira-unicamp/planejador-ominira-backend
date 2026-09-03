import { trace } from "@opentelemetry/api";
import pino, { type Level, type Logger } from "pino";
import { createOpenObserveStream, openObserveConfig } from "./openobserve.js";

export type InjectionChange = {
    entity: string;
    operation: "create" | "update" | "delete";
    key: Record<string, string | number>;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    changedFields?: string[];
};

export type InjectionLogger = Logger & {
    change(change: InjectionChange): void;
};

export function createInjectionLogger(injection: string, runId: string) {
    const level = (process.env.LOG_LEVEL ??
        process.env.POMI_INJECTION_LOG_LEVEL ??
        "info") as Level;
    const options = { level, mixin: traceContext };
    const local = pino(options, pino.destination(1));
    const streams: pino.StreamEntry[] = [
        {
            level,
            stream: pino.destination(1)
        }
    ];
    const openObserve = openObserveConfig();
    if (openObserve)
        streams.push({
            level,
            stream: createOpenObserveStream(openObserve, (error) =>
                local.warn(
                    { err: error, event: "log.export.issue" },
                    "Falha ao enviar logs para OpenObserve"
                )
            )
        });
    const logger = pino(options, pino.multistream(streams)).child({
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

function traceContext() {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext || /^0+$/.test(spanContext.traceId)) return {};
    return { trace_id: spanContext.traceId };
}
