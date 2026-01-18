import { globalPrisma } from "../PrismaClient.js";
import { NextFunction, Request, Response } from "express";

export default async function studentMiddleware(req : Request, res : Response, next: NextFunction) {
	req.prisma = globalPrisma;
	next();
}