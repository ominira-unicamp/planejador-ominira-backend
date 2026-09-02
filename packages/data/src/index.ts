import "dotenv/config";

import {
    createBaseApplication,
    createLogger,
    errorHandler
} from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";

import { loadDataConfig } from "#/Config.js";
import { createDataContainer, dataScopeMiddleware } from "#/Container.js";
import { dataControllers } from "#/Controllers.js";
import openApiRouter from "#/OpenApi.js";

const config = loadDataConfig(process.env);
const database = createDatabaseClient(config.databaseUrl);
const container = createDataContainer(config, database);
const logger = createLogger("pomi-data");
const application = createBaseApplication({
    corsOrigins: config.corsOrigins,
    serviceName: "pomi-data",
    logger
});

for (const path of [
    "/health",
    "/openapi.json",
    "/public-openapi.json",
    "/public-docs",
    "/docs"
]) {
    dataControllers.authRegistry.addException("GET", path);
}

application.use(dataScopeMiddleware(container));
application.get("/health", (_req, res) => res.json({ status: "ok" }));
application.use(dataControllers.authRegistry.middleware());
application.use(openApiRouter);
application.use(dataControllers.router);
application.use(errorHandler);

const port = config.port;
const server = application.listen(port, () => {
    logger.info({ event: "server.started", port }, "POMI Data iniciada");
});

async function shutdown() {
    logger.info({ event: "server.stopping" }, "POMI Data encerrando");
    server.close();
    await database.$disconnect();
    logger.info({ event: "server.stopped" }, "POMI Data encerrada");
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
