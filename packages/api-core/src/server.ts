import cors from "cors";
import express from "express";
import helmet from "helmet";

import jsonErrorHandler from "./middleware/jsonErrorHandler.js";
import sizeLimitMiddleware from "./middleware/sizeLimitMiddleware.js";

export function createBaseApplication(corsConfiguration?: string) {
    const application = express();
    const configuredOrigins = corsConfiguration ?? "*";
    const origins = configuredOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    const origin = origins.length === 0 ? ["*"] : origins;

    application.use(
        cors({
            origin: origin.length === 1 && origin[0] === "*" ? "*" : origin,
            credentials: true
        })
    );
    application.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "'unsafe-eval'",
                        "https://cdn.jsdelivr.net"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://cdn.jsdelivr.net",
                        "https://fonts.googleapis.com"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "https://cdn.jsdelivr.net",
                        "https://fonts.scalar.com"
                    ],
                    imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
                    workerSrc: ["'self'", "blob:"],
                    connectSrc: ["'self'"]
                }
            }
        })
    );
    application.use(express.json());
    application.use(jsonErrorHandler);
    application.use(sizeLimitMiddleware);
    return application;
}
