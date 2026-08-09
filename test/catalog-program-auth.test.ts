import assert from "node:assert/strict";
import test from "node:test";

process.env.DISABLED_AUTH = "true";

test("allows anonymous reads of catalog programs only", async () => {
    const { default: controllers } = await import("../src/Controllers.js");
    const { authRegistry } = controllers;

    assert.equal(authRegistry.checkException("GET", "/catalog-program"), true);
    assert.equal(
        authRegistry.checkException("GET", "/catalog-program/42"),
        true
    );
    assert.equal(
        authRegistry.checkException("POST", "/catalog-program/42"),
        false
    );
    assert.equal(
        authRegistry.checkException("PATCH", "/catalog-program/42"),
        false
    );
    assert.equal(
        authRegistry.checkException("DELETE", "/catalog-program/42"),
        false
    );
});
