import {
    invalidRequestProblem,
    resourceNotFoundProblem,
    sendProblem
} from "@pomi/api-core";
import { NextFunction, Request, Response } from "express";

export default async function studentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (isNaN(Number(req.params.sid))) {
        sendProblem(
            res,
            invalidRequestProblem(
                [
                    {
                        code: "INVALID_TYPE",
                        path: ["path", "sid"],
                        message: "Informe um identificador de estudante válido."
                    }
                ],
                req.path
            )
        );
        return;
    }
    const student = await req.prisma.student.findUnique({
        where: { id: Number(req.params.sid) }
    });
    if (!student) {
        sendProblem(
            res,
            resourceNotFoundProblem(
                "O estudante solicitado não foi encontrado.",
                req.path
            )
        );
        return;
    }
    next();
}
