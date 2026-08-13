import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import {
    appErrorProblem,
    internalServerErrorProblem
} from "../errors/ProblemDetails.js";
import { sendProblem } from "../http/problemResponse.js";

function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (err instanceof AppError) {
        sendProblem(res, appErrorProblem(err, req.path));
        return;
    }
    if (err && typeof err === "object" && "stack" in err) {
        console.error((err as { stack?: string }).stack);
    }
    sendProblem(res, internalServerErrorProblem(req.path));
}

export default errorHandler;
