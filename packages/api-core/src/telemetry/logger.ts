import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";

import type { RequestHandler, Response } from "express";
import pino, { type Level, type Logger } from "pino";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;

export function createLogger(service: string): Logger {
    const level = (process.env.LOG_LEVEL ?? "info") as Level;
    const options = {
        level,
        base: { service },
        redact: {
            paths: [
                "authorization",
                "cookie",
                "password",
                "token",
                "*.authorization",
                "*.cookie",
                "*.password",
                "*.token"
            ],
            censor: "[Redacted]"
        }
    };
    const local = pino(options, pino.destination(1));
    const streams: pino.StreamEntry[] = [
        { level, stream: pino.destination(1) }
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
    return pino(options, pino.multistream(streams));
}

export function createHttpTelemetryMiddleware(logger: Logger): RequestHandler {
    return (request, response, next) => {
        const requestId = requestIdFrom(request.header(REQUEST_ID_HEADER));
        const requestLogger = logger.child({ requestId });
        const startedAt = process.hrtime.bigint();
        response.setHeader(REQUEST_ID_HEADER, requestId);
        response.locals.pomiLogger = requestLogger;

        response.on("finish", () => {
            const durationMs =
                Number(process.hrtime.bigint() - startedAt) / 1e6;
            const attributes = {
                event: "http.request.completed",
                method: request.method,
                route: requestRoute(request),
                statusCode: response.statusCode,
                durationMs: Number(durationMs.toFixed(3)),
                responseContentLength: contentLength(response)
            };
            if (response.statusCode >= 500)
                requestLogger.error(attributes, "Requisição HTTP concluída");
            else if (response.statusCode >= 400)
                requestLogger.warn(attributes, "Requisição HTTP concluída");
            else requestLogger.info(attributes, "Requisição HTTP concluída");
        });
        next();
    };
}

export function requestLogger(response: Response): Logger | undefined {
    return response.locals.pomiLogger as Logger | undefined;
}

function requestIdFrom(value: string | undefined) {
    if (
        value &&
        value.length <= MAX_REQUEST_ID_LENGTH &&
        /^[A-Za-z0-9._:-]+$/.test(value)
    )
        return value;
    return randomUUID();
}

function requestRoute(request: { route?: { path?: unknown } }) {
    const route = request.route?.path;
    if (typeof route === "string") return route;
    return "unmatched";
}

function contentLength(response: Response) {
    const value = response.getHeader("content-length");
    return typeof value === "string" ? Number(value) : value;
}

type OpenObserveConfig = { url: string; auth: string };

function openObserveConfig(): OpenObserveConfig | undefined {
    const url = process.env.OPENOBSERVE_URL?.trim();
    if (!url) return undefined;
    const auth =
        process.env.OPENOBSERVE_AUTH?.trim() ||
        (process.env.OPENOBSERVE_USER && process.env.OPENOBSERVE_PASSWORD
            ? `Basic ${Buffer.from(
                  `${process.env.OPENOBSERVE_USER}:${process.env.OPENOBSERVE_PASSWORD}`
              ).toString("base64")}`
            : undefined);
    if (!auth)
        throw new Error(
            "OPENOBSERVE_AUTH ou OPENOBSERVE_USER/OPENOBSERVE_PASSWORD deve ser configurado quando OPENOBSERVE_URL estiver definido"
        );
    const stream = process.env.OPENOBSERVE_STREAM?.trim() || "pomi-api-logs";
    return { url: `${url.replace(/\/$/, "")}/${stream}/_json`, auth };
}

function createOpenObserveStream(
    options: OpenObserveConfig,
    onError: (error: unknown) => void
): Writable {
    const queue: unknown[] = [];
    let flushing = false;
    let timer: NodeJS.Timeout | undefined;
    const flush = async (): Promise<void> => {
        if (flushing || queue.length === 0) return;
        flushing = true;
        const batch = queue.splice(0, 50);
        try {
            const response = await fetch(options.url, {
                method: "POST",
                headers: {
                    "Authorization": options.auth,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(batch),
                signal: AbortSignal.timeout(5_000)
            });
            if (!response.ok)
                throw new Error(
                    `OpenObserve respondeu HTTP ${response.status}`
                );
        } catch (error) {
            onError(error);
        } finally {
            flushing = false;
            if (queue.length > 0) void flush();
        }
    };
    const scheduleFlush = () => {
        if (timer) return;
        timer = setTimeout(() => {
            timer = undefined;
            void flush();
        }, 250);
    };
    return new Writable({
        write(chunk, _encoding, callback) {
            try {
                if (queue.length >= 1_000) queue.shift();
                queue.push(JSON.parse(chunk.toString()));
                if (queue.length >= 50) void flush();
                else scheduleFlush();
            } catch (error) {
                onError(error);
            }
            callback();
        }
    });
}
