import type { ErrorRequestHandler } from "express";
import { malformedJsonProblem } from "../errors/ProblemDetails.js";
import { sendProblem } from "../http/problemResponse.js";

const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (
        err instanceof SyntaxError &&
        "status" in err &&
        err.status === 400 &&
        "body" in err
    ) {
        console.error("Invalid JSON body:", err.message);
        return sendProblem(res, malformedJsonProblem(req.path));
    }
    next(err);
};
export default jsonErrorHandler;
