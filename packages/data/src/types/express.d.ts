import type { DatabaseClient } from "@pomi/db";

declare global {
    namespace Express {
        interface Request {
            prisma: DatabaseClient;
        }
    }
}

export {};
