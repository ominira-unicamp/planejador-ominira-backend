import { Principal } from "#/auth.js";
import { JWTPayload } from "jose";
import { PrismaClient } from "../../prisma/generated/client.js";

declare global {
    namespace Express {
        interface Request {
            prisma: PrismaClient;
            user?: JWTPayload;
            principal?: Principal;
        }
    }
}
