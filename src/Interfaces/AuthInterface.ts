import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import { pathSeg } from "../PathSegment.js";

extendZodWithOpenApi(z);

const loginResponse = z
    .object({
        accessToken: z
            .string()
            .describe(
                "JWT access token to be used in Authorization header as Bearer token"
            )
    })
    .openapi("LoginResponse");

const login = {
    specs: {
        method: "post",
        path: [pathSeg.literal("login")],
        tags: ["login"]
    },
    input: z.object({}),
    output: new OutputBuilder()
        .ok(loginResponse, "Successful login response")
        .build()
} satisfies IO;

export default {
    login
};
