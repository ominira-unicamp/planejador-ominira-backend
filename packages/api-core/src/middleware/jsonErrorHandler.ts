import type { ErrorRequestHandler } from "express";
import { malformedJsonProblem } from "../errors/ProblemDetails.js";
import { sendProblem } from "../http/problemResponse.js";
import { requestLogger } from "../telemetry/logger.js";

const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (
        err instanceof SyntaxError &&
        "status" in err &&
        err.status === 400 &&
        "body" in err
    ) {
        requestLogger(res)?.warn(
            { err, event: "http.request.invalid_json", method: req.method },
            "Corpo JSON inválido"
        );
        return sendProblem(res, malformedJsonProblem(req.path));
    }
    next(err);
};
export default jsonErrorHandler;
