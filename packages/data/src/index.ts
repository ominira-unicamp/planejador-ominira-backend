import "dotenv/config";

import { createBaseApplication, errorHandler } from "@pomi/api-core";
import { createDatabaseClient } from "@pomi/db";

import { dataControllers } from "#/Controllers.js";
import openApiRouter from "#/OpenApi.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const database = createDatabaseClient(connectionString);
const application = createBaseApplication(
    process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
);

for (const path of [
    "/health",
    "/openapi.json",
    "/public-openapi.json",
    "/public-docs",
    "/docs"
]) {
    dataControllers.authRegistry.addException("GET", path);
}

application.use((req, _res, next) => {
    req.prisma = database;
    next();
});
application.get("/health", (_req, res) => res.json({ status: "ok" }));
application.use(dataControllers.authRegistry.middleware());
application.use(openApiRouter);
application.use(dataControllers.router);
application.use(errorHandler);

const port = Number(process.env.PORT ?? process.env.POMI_DATA_PORT ?? 3000);
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
