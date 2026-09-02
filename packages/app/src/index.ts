import "dotenv/config";

import {
    createBaseApplication,
    createLogger,
    errorHandler
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
    "/openapi.json",
    "/student-openapi.json",
    "/student-docs",
    "/docs"
]) {
    appControllers.authRegistry.addException("GET", path);
}

application.use(appScopeMiddleware(container));
application.get("/health", (_req, res) => res.json({ status: "ok" }));
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
    server.close();
    await database.$disconnect();
    logger.info({ event: "server.stopped" }, "POMI App encerrada");
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
