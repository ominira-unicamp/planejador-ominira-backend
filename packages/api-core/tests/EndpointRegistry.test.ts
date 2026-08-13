import assert from "node:assert/strict";
import test from "node:test";

import type { Request } from "express";
import z from "zod";

import {
    ApiResponse,
    createEndpointRegistries,
    pathSeg,
    ResponseSchemaBuilder
} from "../src/index.js";

const contracts = {
    list: {
        meta: {
            method: "get" as const,
            path: [pathSeg.literal("items")],
            tags: ["items"],
            authorization: { kind: "public" as const }
        },
        request: z.object({ query: z.object({}) }),
        response: new ResponseSchemaBuilder()
            .ok(z.array(z.string()), "Items")
            .build()
    }
};

test("builds Express, OpenAPI and authorization registries from one contract", () => {
    const policies: Array<{ method: string; path: string; kind: string }> = [];
    const registries = createEndpointRegistries({
        contracts,
        actions: { list: async () => ApiResponse.ok([]) },
        createContext: (_request: Request) => ({}),
        registerAuthorization: (method, path, authorization) => {
            policies.push({ method, path, kind: authorization.kind });
        }
    });

    assert.equal(registries.openApiRegistry.definitions.length, 1);
    assert.deepEqual(policies, [
        { method: "GET", path: "/items", kind: "public" }
    ]);
});

test("fails during composition when an action is missing", () => {
    assert.throws(
        () =>
            createEndpointRegistries({
                contracts,
                actions: {} as never,
                createContext: () => ({}),
                registerAuthorization: () => undefined
            }),
        /Missing action for endpoint list/
    );
});
