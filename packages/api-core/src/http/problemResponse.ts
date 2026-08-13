import type { Response } from "express";

import type { ProblemDetails } from "../errors/ProblemDetails.js";

export const problemContentType = "application/problem+json";

export function sendProblem(response: Response, problem: ProblemDetails) {
    const target = response.status(problem.status);
    if (typeof target.type === "function") target.type(problemContentType);
    return target.json(problem);
}
