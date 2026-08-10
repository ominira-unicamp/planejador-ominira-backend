import Controlellers from "#/Controllers.js";
import errorHandler from "#/Middlewares/erroHandler.js";
import jsonErrorHandler from "#/Middlewares/jsonErrorHandler.js";
import prismaInjectMiddleware from "#/Middlewares/prismaInjectMiddleware.js";
import sizeLimitMiddleware from "#/Middlewares/sizeLimitMiddleware.js";
import openapi from "#/OpenApi.js";
import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";

const app = express();
const configuredCorsOrigins =
    process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? "*";
const corsOrigins = configuredCorsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const corsOrigin = corsOrigins.length === 0 ? "*" : corsOrigins;
app.use(
    cors({
        origin:
            corsOrigin.length === 1 && corsOrigin[0] === "*" ? "*" : corsOrigin,
        credentials: true
    })
);

Controlellers.authRegistry.addException("GET", "/openapi.json");
Controlellers.authRegistry.addException("GET", "/public-openapi.json");
Controlellers.authRegistry.addException("GET", "/student-openapi.json");
Controlellers.authRegistry.addException("GET", "/public-docs");
Controlellers.authRegistry.addException("GET", "/student-docs");
Controlellers.authRegistry.addException("GET", "/docs");
Controlellers.authRegistry.addException("GET", "/api-docs");

app.use(
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
app.use(express.json());
app.use(jsonErrorHandler);
app.use(prismaInjectMiddleware);
app.use(sizeLimitMiddleware);
app.use(Controlellers.authRegistry.middleware());
app.use(openapi.router);
app.use(Controlellers.router);
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    if (process.env.NODE_ENV !== "production") {
        console.log(`Docs: http://localhost:${port}/docs`);
    }
});
