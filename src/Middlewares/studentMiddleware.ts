import { NextFunction, Request, Response } from "express";
import z from "zod";
import { ValidationError, ZodToApiError } from "../Validation.js";

const disabled = process.env.DISABLED_AUTH === "true";

export default async function studentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const {
        success,
        data: sid,
        error
    } = z.coerce.number().int().safeParse(req.params.sid);

    if (!success) {
        res.status(400).json(
            new ValidationError(ZodToApiError(error, ["path", "sid"]))
        );
        return;
    }
    if (!disabled) {
        if (!req.user || req.user.id != sid) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
    }
    const student = await req.prisma.student.findUnique({ where: { id: sid } });
    if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
    }
    next();
}
