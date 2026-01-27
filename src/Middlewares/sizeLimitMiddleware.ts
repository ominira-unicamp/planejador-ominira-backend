import type { NextFunction, Request, Response } from "express";

function sizeLimitMiddleware(_req: Request, res: Response, next: NextFunction) {
    const oldSend = res.send;

    res.send = function (body?: unknown): Response {
        const sizeLimit = 1024 * 1024 * 31; // 31 MB limit
        const bodySize = Buffer.byteLength(
            typeof body === "string" ? body : JSON.stringify(body)
        );

        if (bodySize > sizeLimit) {
            res.status(418);
            return oldSend.call(
                res,
                JSON.stringify({
                    error: "Response Object Too Large",
                    message: `Response size of ${(
                        bodySize /
                        (1024 * 1024)
                    ).toFixed(2)} MB exceeds the limit of 31 MB.`
                })
            );
        }

        return oldSend.call(res, body);
    };

    next();
}

export default sizeLimitMiddleware;
