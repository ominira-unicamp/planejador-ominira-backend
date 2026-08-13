import type { NextFunction, Request, Response } from "express";

function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (err && typeof err === "object" && "stack" in err) {
        console.error((err as { stack?: string }).stack);
    }
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
}

export default errorHandler;
