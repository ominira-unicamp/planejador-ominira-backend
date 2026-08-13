import assert from "node:assert/strict";
import test from "node:test";

import type { Request, Response } from "express";
import z from "zod";

import {
    ApiResponse,
    buildEndpointHandler,
    pathSeg,
    ResponseEffects,
    ResponseSchemaBuilder
} from "../src/index.js";

const contract = {
    meta: {
        method: "post" as const,
        path: [pathSeg.literal("items")],
        tags: ["items"],
        authorization: { kind: "public" as const }
    },
    request: z.object({ body: z.object({ name: z.string().min(1) }) }),
    response: new ResponseSchemaBuilder()
        .created(z.object({ name: z.string() }), "Created")
        .build()
};

function responseRecorder() {
    const recorded: { status?: number; body?: unknown; cookies: string[] } = {
        cookies: []
    };
    const response = {
        status(status: number) {
            recorded.status = status;
            return response;
        },
        json(body: unknown) {
            recorded.body = body;
            return response;
        },
        send() {
            return response;
        },
        cookie(name: string) {
            recorded.cookies.push(name);
            return response;
        },
        clearCookie() {
            return response;
        }
    } as unknown as Response;
    return { response, recorded };
}

test("validates requests and executes a declarative action", async () => {
    const { response, recorded } = responseRecorder();
    const handler = buildEndpointHandler(
        contract,
        async (_context, request) =>
            ApiResponse.created({ name: request.body.name }, [
                ResponseEffects.setCookie("session", "value", {})
            ]),
        () => ({})
    );

    await handler(
        {
            body: { name: "POMI" },
            query: {},
            params: {},
            headers: {}
        } as Request,
        response
    );

    assert.equal(recorded.status, 201);
    assert.deepEqual(recorded.body, { name: "POMI" });
    assert.deepEqual(recorded.cookies, ["session"]);
});

test("preserves the existing validation error response", async () => {
    const { response, recorded } = responseRecorder();
    const handler = buildEndpointHandler(
        contract,
        async () => ApiResponse.created({ name: "unreachable" }),
        () => ({})
    );

    await handler(
        { body: { name: "" }, query: {}, params: {}, headers: {} } as Request,
        response
    );

    assert.equal(recorded.status, 400);
    assert.equal(
        (recorded.body as { message: string }).message,
        "Validation error"
    );
});
