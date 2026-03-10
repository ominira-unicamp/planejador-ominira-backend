import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";
import z from "zod";
import { AuthRegistry, generateToken } from "../../auth.js";
import { buildHandler, Context } from "../../BuildHandler.js";
import IO from "./Interface.js";
import registry from "./OpenAPI.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("POST", "/login");

authRegistry.addException("POST", "/auth/google");

async function googleFn(
    ctx: Context,
    input: z.infer<typeof IO.google.input>
): Promise<z.infer<typeof IO.google.output>> {
    const token = input.body.credential;
    const jwks = createRemoteJWKSet(
        new URL("https://www.googleapis.com/oauth2/v3/certs")
    );
    try {
        const verifyOptions: JWTVerifyOptions = {};
        if (process.env.GOOGLE_CLIENT_ID)
            verifyOptions.audience = process.env.GOOGLE_CLIENT_ID;
        const { payload } = await jwtVerify(token, jwks, verifyOptions);

        const email = payload.email as string | undefined;
        const name =
            (payload.name as string | undefined) ||
            (email ? email.split("@")[0] : "GoogleUser");

        if (!email) return { 401: "Invalid token: no email" };
        const prisma = ctx.prisma;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email, name } });
        }
        const accessToken = await generateToken({ userId: user.id });
        return { 200: { accessToken } };
    } catch (_err) {
        return { 401: "Invalid token" };
    }
}

router.post(
    "/auth/google",
    buildHandler(IO.google.input, IO.google.output, googleFn)
);

export default {
    router,
    registry,
    authRegistry,
    paths: {
        login: () => "/login",
        google: () => "/auth/google"
    }
};
