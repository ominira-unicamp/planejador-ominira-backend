import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import {
    appErrorProblem,
    internalServerErrorProblem
} from "../errors/ProblemDetails.js";
import { sendProblem } from "../http/problemResponse.js";
import { requestLogger } from "../telemetry/logger.js";

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
    requestLogger(res)?.error(
        { err, event: "http.request.failed", method: req.method },
        "Erro não tratado durante requisição HTTP"
    );
    sendProblem(res, internalServerErrorProblem(req.path));
}

export default errorHandler;
