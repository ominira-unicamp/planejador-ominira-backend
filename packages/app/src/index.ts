import "dotenv/config";

import { createBaseApplication, errorHandler } from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";

import { loadAppConfig } from "#/Config.js";
import { appScopeMiddleware, createAppContainer } from "#/Container.js";
import { appControllers } from "#/Controllers.js";
import openApiRouter from "#/OpenApi.js";

const config = loadAppConfig(process.env);
const database = createDatabaseClient(config.databaseUrl);
const container = createAppContainer(config, database);
const application = createBaseApplication(config.corsOrigins);

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
    if (process.env.NODE_ENV !== "production") {
        console.log(`POMI App docs: http://localhost:${port}/docs`);
    }
});

async function shutdown() {
    server.close();
    await database.$disconnect();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
