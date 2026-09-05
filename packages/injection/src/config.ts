import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

const commandSchema = z.object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().default("."),
    env: z.record(z.string(), z.string()).default({}),
    timeoutMs: z.number().int().positive().default(3_600_000)
});

const injectionSchema = z.object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    description: z.string().optional(),
    schedule: z.object({ intervalMs: z.number().int().positive() }).optional(),
    obtain: commandSchema,
    input: z.object({
        directory: z.string().min(1),
        fileName: z.string().min(1)
    }),
    options: z.record(z.string(), z.unknown()).default({}),
    allowIssues: z.boolean().default(false),
    partitioning: z
        .union([
            z.object({
                kind: z.literal("year"),
                firstYear: z.number().int().min(1900)
            }),
            z.object({ kind: z.literal("institute") })
        ])
        .optional()
});

export const injectionConfigSchema = z.object({
    version: z.literal(1),
    rootDirectory: z.string().default("."),
    injections: z.array(injectionSchema)
});

export type InjectionDefinition = z.infer<typeof injectionSchema>;
export type InjectionConfig = z.infer<typeof injectionConfigSchema> & {
    configDirectory: string;
};

export async function loadInjectionConfig(path = "injections.json") {
    const configPath = resolve(path);
    const parsed = injectionConfigSchema.parse(
        JSON.parse(await readFile(configPath, "utf8"))
    );
    const names = new Set<string>();
    for (const injection of parsed.injections) {
        if (names.has(injection.name))
            throw new Error(`Injection duplicada: ${injection.name}`);
        names.add(injection.name);
    }
    return {
        ...parsed,
        rootDirectory: resolve(parsed.rootDirectory),
        configDirectory: resolve(configPath, "..")
    };
}

export function resolveCommandCwd(
    rootDirectory: string,
    configDirectory: string,
    cwd: string
) {
    return resolve(configDirectory, rootDirectory, cwd);
}

export function resolveInputPath(
    definition: InjectionDefinition,
    rootDirectory: string,
    configDirectory: string
) {
    const directory = resolve(
        configDirectory,
        rootDirectory,
        definition.input.directory
    );
    return resolve(directory, definition.input.fileName);
}

export function interpolate(value: string, variables: Record<string, string>) {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (full, name: string) => {
        const replacement = variables[name];
        if (replacement === undefined)
            throw new Error(`Variável não definida: ${name}`);
        return replacement;
    });
}

export function isPathInside(parent: string, child: string) {
    const base = resolve(parent) + "/";
    return (
        isAbsolute(child) &&
        (child === resolve(parent) || child.startsWith(base))
    );
}
