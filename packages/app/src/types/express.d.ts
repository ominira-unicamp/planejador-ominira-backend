import type { DatabaseClient } from "@pomi/db";
import type { AwilixContainer } from "awilix";
import type { JWTPayload } from "jose";

import type { AppCradle } from "#/Container.js";
import type { Principal } from "../auth.js";

declare global {
    namespace Express {
        interface Request {
            prisma: DatabaseClient;
            scope: AwilixContainer<AppCradle>;
            user?: JWTPayload;
            principal?: Principal;
        }
    }
}

export {};
