import { metrics } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

let instruments:
    | {
          requests: ReturnType<
              ReturnType<typeof metrics.getMeter>["createCounter"]
          >;
          duration: ReturnType<
              ReturnType<typeof metrics.getMeter>["createHistogram"]
          >;
      }
    | undefined;

function getInstruments() {
    instruments ??= (() => {
        const meter = metrics.getMeter("pomi-http");
        return {
            requests: meter.createCounter("pomi_http_requests_total", {
                description: "Quantidade de requisições HTTP concluídas"
            }),
            duration: meter.createHistogram("pomi_http_request_duration_ms", {
                description: "Duração de requisições HTTP concluídas",
                unit: "ms"
            })
        };
    })();
    return instruments;
}

export function createHttpMetricsMiddleware() {
    return (request: Request, response: Response, next: NextFunction) => {
        const { requests, duration } = getInstruments();
        const startedAt = performance.now();
        response.prependListener("finish", () => {
            const attributes = {
                "http.request.method": request.method,
                "http.route": requestRoute(request),
                "http.response.status_code": response.statusCode
            };
            requests.add(1, attributes);
            duration.record(performance.now() - startedAt, attributes);
        });
        next();
    };
}

export function requestRoute(request: Request) {
    const route = request.route?.path;
    if (typeof route !== "string") return "unmatched";
    return `${request.baseUrl}${route}` || "/";
}
