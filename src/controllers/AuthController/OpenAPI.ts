import {
    extendZodWithOpenApi,
    OpenAPIRegistry
} from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { openApiArgsFromIO } from "../../BuildHandler.js";
import IO from "./Interface.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
    method: "post",
    path: "/login",
    tags: ["auth"],
    ...openApiArgsFromIO(IO.login)
});

registry.registerPath({
    method: "post",
    path: "/auth/google",
    tags: ["auth"],
    ...openApiArgsFromIO(IO.google)
});

export default registry;
