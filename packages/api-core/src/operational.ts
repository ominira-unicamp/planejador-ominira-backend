import type { RequestHandler } from "express";

export function createReadinessHandler(
    checkReadiness: () => Promise<unknown>
): RequestHandler {
    return async (_request, response) => {
        try {
            await checkReadiness();
            response.json({ status: "ready" });
        } catch {
            response.status(503).json({ status: "not_ready" });
        }
    };
}

export function createVersionHandler({
    service,
    version,
    environment
}: Readonly<{
    service: string;
    version: string;
    environment: string;
}>): RequestHandler {
    return (_request, response) =>
        response.json({ service, version, environment });
}
