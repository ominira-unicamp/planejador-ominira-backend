import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import z from "zod";
import { AuthRegistry, generateToken } from "../../auth.js";
import {
    buildHandler,
    Context,
    openApiArgsFromIO
} from "../../BuildHandler.js";
import IO from "../../Interfaces/AuthInterface.js";

extendZodWithOpenApi(z);

const router = Router();
const authRegistry = new AuthRegistry();

authRegistry.addException("POST", "/login");

async function loginFn(
    _ctx: Context,
    _input: z.infer<typeof IO.login.input>
): Promise<z.infer<typeof IO.login.output>> {
    const token = await generateToken({ userId: 1 });
    return { 200: { accessToken: token } };
}

router.post("/login", buildHandler(IO.login.input, IO.login.output, loginFn));

const registry = new OpenAPIRegistry();
registry.registerPath(openApiArgsFromIO(IO.login));

export default {
    router,
    registry,
    authRegistry,
    paths: {
        login: () => "/login"
    },
    login: loginFn
};
