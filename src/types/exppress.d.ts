import { JWTPayload } from "jose";
import { PrismaClient } from "../../prisma/generated/client.js";
import { Principal } from "../auth.js";

declare global {
    namespace Express {
        interface Request {
            prisma: PrismaClient;
            user?: JWTPayload;
            principal?: Principal;
        }
    }
}
