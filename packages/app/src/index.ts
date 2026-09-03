import {
    createBaseApplication,
    createLogger,
    createReadinessHandler,
    createVersionHandler,
    errorHandler,
    shutdownTelemetry
} from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";

import { loadAppConfig } from "#/Config.js";
import { appScopeMiddleware, createAppContainer } from "#/Container.js";
import { appControllers } from "#/Controllers.js";
import openApiRouter from "#/OpenApi.js";

const config = loadAppConfig(process.env);
const database = createDatabaseClient(config.databaseUrl);
const container = createAppContainer(config, database);
const logger = createLogger("pomi-app");
const application = createBaseApplication({
    corsOrigins: config.corsOrigins,
    serviceName: "pomi-app",
    logger
});

for (const path of [
    "/health",
    "/ready",
    "/version",
    "/openapi.json",
    "/student-openapi.json",
    "/student-docs",
    "/docs"
]) {
    appControllers.authRegistry.addException("GET", path);
}

application.use(appScopeMiddleware(container));
application.get("/health", (_req, res) => res.json({ status: "ok" }));
application.get(
    "/ready",
    createReadinessHandler(() => database.$queryRaw`SELECT 1`)
);
application.get(
    "/version",
    createVersionHandler({
        service: "pomi-app",
        version: process.env.SERVICE_VERSION ?? "unknown",
        environment:
            process.env.DEPLOYMENT_ENVIRONMENT_NAME ??
            process.env.NODE_ENV ??
            "development"
    })
);
application.use(appControllers.authRegistry.middleware());
application.use(openApiRouter);
application.use(appControllers.router);
application.use(errorHandler);

const port = config.port;
const server = application.listen(port, () => {
    logger.info({ event: "server.started", port }, "POMI App iniciada");
});

async function shutdown() {
    logger.info({ event: "server.stopping" }, "POMI App encerrando");
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    try {
        await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
        await database.$disconnect();
        await shutdownTelemetry();
        logger.info({ event: "server.stopped" }, "POMI App encerrada");
    } catch (error) {
        logger.error({ err: error }, "Falha ao encerrar POMI App");
        process.exitCode = 1;
    } finally {
        clearTimeout(timeout);
    }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
