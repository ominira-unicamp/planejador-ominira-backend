import { AuthRoles } from "#/auth.js";
import { createDatabaseClient } from "@pomi/db";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const database = createDatabaseClient(connectionString);

async function main() {
    const subjectArgument = process.argv.indexOf("--subject");
    const issuerArgument = process.argv.indexOf("--issuer");
    const subject =
        subjectArgument >= 0
            ? process.argv[subjectArgument + 1]?.trim()
            : undefined;
    const issuer = (
        issuerArgument >= 0
            ? process.argv[issuerArgument + 1]
            : process.env.KEYCLOAK_ISSUER
    )?.replace(/\/$/, "");

    if (!subject) {
        throw new Error(
            "Usage: npm run auth:bootstrap-admin -- --subject <keycloak-subject>"
        );
    }
    if (!issuer) {
        throw new Error(
            "KEYCLOAK_ISSUER is required. Set it in the environment or pass --issuer <realm-issuer>."
        );
    }

    const authUser = await database.authUser.upsert({
        where: { issuer_subject: { issuer, subject } },
        create: {
            issuer,
            subject,
            roles: { create: { role: AuthRoles.ADMIN } }
        },
        update: { status: "ACTIVE" }
    });

    await database.authUserRole.upsert({
        where: {
            authUserId_role: { authUserId: authUser.id, role: AuthRoles.ADMIN }
        },
        create: { authUserId: authUser.id, role: AuthRoles.ADMIN },
        update: {}
    });

    console.log(`Administrator ${authUser.id} is active.`);
}

void main().finally(() => database.$disconnect());
