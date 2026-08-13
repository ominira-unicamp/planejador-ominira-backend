import type { DatabaseClient } from "@pomi/db";
import type { AwilixContainer } from "awilix";

import type { DataCradle } from "#/Container.js";

declare global {
    namespace Express {
        interface Request {
            prisma: DatabaseClient;
            scope: AwilixContainer<DataCradle>;
        }
    }
}

export {};
