import { config } from "dotenv";
import { resolve } from "node:path";
import {
    createDatabaseClient,
    synchronizeAcademicPositionCatalog
} from "../src/index.js";

async function main() {
    config({ path: resolve(import.meta.dirname, "../../../.env") });
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório");
    const database = createDatabaseClient(databaseUrl, { max: 1 });
    try {
        const result = await synchronizeAcademicPositionCatalog(database);
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } finally {
        await database.$disconnect();
    }
}

main().catch((error) => {
    process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
});
