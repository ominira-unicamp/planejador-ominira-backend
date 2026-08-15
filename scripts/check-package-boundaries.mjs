import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../packages", import.meta.url));
const restrictions = {
    "api-core": ["@pomi/db", "@pomi/data", "@pomi/app", "@pomi/injection"],
    "data": ["@pomi/app", "@pomi/injection"],
    "app": ["@pomi/data", "@pomi/injection"],
    "injection": ["@pomi/api-core", "@pomi/data", "@pomi/app"]
};

async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const path = join(directory, entry.name);
            if (entry.isDirectory() && entry.name !== "dist") {
                return sourceFiles(path);
            }
            return entry.isFile() && extname(path) === ".ts" ? [path] : [];
        })
    );
    return nested.flat();
}

const violations = [];
for (const [packageName, forbidden] of Object.entries(restrictions)) {
    for (const file of await sourceFiles(join(root, packageName))) {
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
            if (
                forbidden.some(
                    (specifier) =>
                        match[1] === specifier ||
                        match[1].startsWith(`${specifier}/`)
                )
            ) {
                violations.push(`${relative(root, file)} imports ${match[1]}`);
            }
            if (
                packageName !== "db" &&
                (match[1].includes("prisma/generated") ||
                    match[1].includes("packages/db/src"))
            ) {
                violations.push(`${relative(root, file)} bypasses @pomi/db`);
            }
        }
    }
}

for (const file of await sourceFiles(join(root, "app", "src", "modules"))) {
    const source = await readFile(file, "utf8");
    const path = relative(root, file);
    if (file.endsWith(".service.ts")) {
        for (const forbidden of [
            'from "#/BuildHandler.js"',
            'from "#/Contract.js"',
            'from "express"',
            "ApiResponse",
            "ResponseSchemaBuilder"
        ]) {
            if (source.includes(forbidden)) {
                violations.push(
                    `${path} mixes the service layer with ${forbidden}`
                );
            }
        }
    }
    if (file.endsWith(".controller.ts")) {
        for (const forbidden of [
            "ctx.prisma",
            "ctx.zodIds",
            "request.prisma"
        ]) {
            if (source.includes(forbidden)) {
                violations.push(
                    `${path} accesses persistence through ${forbidden}`
                );
            }
        }
    }
}

if (violations.length > 0) {
    throw new Error(`Package boundary violations:\n${violations.join("\n")}`);
}
