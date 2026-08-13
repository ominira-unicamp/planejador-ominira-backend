import type { DatabaseClient } from "@pomi/db";
import type { JWTPayload } from "jose";

import type { Principal } from "../auth.js";

declare global {
    namespace Express {
        interface Request {
            prisma: DatabaseClient;
            user?: JWTPayload;
            principal?: Principal;
        }
    }
}

export {};
