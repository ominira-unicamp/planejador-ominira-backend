import "dotenv/config";

import { createBaseApplication, errorHandler } from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";

import { loadDataConfig } from "#/Config.js";
import { createDataContainer, dataScopeMiddleware } from "#/Container.js";
import { dataControllers } from "#/Controllers.js";
import openApiRouter from "#/OpenApi.js";

const config = loadDataConfig(process.env);
const database = createDatabaseClient(config.databaseUrl);
const container = createDataContainer(config, database);
const application = createBaseApplication(config.corsOrigins);

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
    if (process.env.NODE_ENV !== "production") {
        console.log(`POMI Data docs: http://localhost:${port}/docs`);
    }
});

async function shutdown() {
    server.close();
    await database.$disconnect();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
