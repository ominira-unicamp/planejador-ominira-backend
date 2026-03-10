import { NextFunction, Request, Response } from "express";
import { globalPrisma } from "../PrismaClient.js";

export default async function studentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    req.prisma = globalPrisma;
    next();
}
