import { exportJWK, generateKeyPair, SignJWT } from "jose";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

let server: http.Server;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let issuer: string;
let verifyAccessToken: (token: string) => Promise<unknown>;

before(async () => {
    const keys = await generateKeyPair("RS256", { extractable: true });
    privateKey = keys.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    Object.assign(publicJwk, { alg: "RS256", kid: "pomi-test", use: "sig" });

    server = http.createServer((_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("JWKS test server did not start.");
    }

    issuer = `http://127.0.0.1:${address.port}/realms/pomi`;
    process.env.DISABLED_AUTH = "false";
    process.env.KEYCLOAK_ISSUER = issuer;
    process.env.KEYCLOAK_AUDIENCE = "pomi-api";
    ({ verifyAccessToken } = await import("#/auth.js"));
});

after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    );
});

async function signToken(overrides: Record<string, unknown> = {}) {
    const token = new SignJWT({ ...overrides })
        .setProtectedHeader({ alg: "RS256", kid: "pomi-test" })
        .setIssuer(issuer)
        .setAudience("pomi-api")
        .setSubject("keycloak-user")
        .setIssuedAt()
        .setExpirationTime("5m");
    return token.sign(privateKey);
}

test("accepts a valid Keycloak access token", async () => {
    const payload = (await verifyAccessToken(await signToken())) as {
        sub?: string;
    };
    assert.equal(payload.sub, "keycloak-user");
});

test("rejects a token for another audience", async () => {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "pomi-test" })
        .setIssuer(issuer)
        .setAudience("another-api")
        .setSubject("keycloak-user")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    await assert.rejects(verifyAccessToken(token));
});

test("rejects a token for another issuer", async () => {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "pomi-test" })
        .setIssuer("https://issuer.invalid/realms/pomi")
        .setAudience("pomi-api")
        .setSubject("keycloak-user")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    await assert.rejects(verifyAccessToken(token));
});

test("rejects an expired token", async () => {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "pomi-test" })
        .setIssuer(issuer)
        .setAudience("pomi-api")
        .setSubject("keycloak-user")
        .setIssuedAt()
        .setExpirationTime(0)
        .sign(privateKey);
    await assert.rejects(verifyAccessToken(token));
});

test("rejects a token without a subject", async () => {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "pomi-test" })
        .setIssuer(issuer)
        .setAudience("pomi-api")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    await assert.rejects(verifyAccessToken(token));
});
