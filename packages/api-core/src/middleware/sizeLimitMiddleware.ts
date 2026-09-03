import type { NextFunction, Request, Response } from "express";
import { problemContentType } from "../http/problemResponse.js";

function responseTooLargeProblem(instance: string) {
    return {
        type: "urn:pomi:problem:payload-too-large",
        title: "Resposta muito grande",
        status: 413,
        detail: "A resposta excede o tamanho máximo permitido.",
        instance
    };
}

function bodyByteLength(body: unknown) {
    const serializedBody =
        typeof body === "string" ? body : (JSON.stringify(body) ?? "");
    return Buffer.byteLength(serializedBody);
}

function sizeLimitMiddleware(_req: Request, res: Response, next: NextFunction) {
    const oldSend = res.send;
    const oldJson = res.json;

    res.json = function (body?: unknown): Response {
        const sizeLimit = 1024 * 1024 * 31; // 31 MB limit
        const bodySize = bodyByteLength(body);

        if (bodySize > sizeLimit) {
            res.status(413).type(problemContentType);
            return oldSend.call(
                res,
                JSON.stringify(responseTooLargeProblem(_req.path))
            );
        }

        return oldJson.call(res, body);
    };

    res.send = function (body?: unknown): Response {
        const sizeLimit = 1024 * 1024 * 31; // 31 MB limit
        const bodySize = bodyByteLength(body);

        if (bodySize > sizeLimit) {
            res.status(413).type(problemContentType);
            return oldSend.call(
                res,
                JSON.stringify(responseTooLargeProblem(_req.path))
            );
        }

        return oldSend.call(res, body);
    };

    next();
}

export default sizeLimitMiddleware;
