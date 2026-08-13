import z from "zod";

const dataConfigSchema = z.object({
    databaseUrl: z.string().min(1),
    corsOrigins: z.string().optional(),
    port: z.coerce.number().int().min(1).max(65535).default(3000),
    dataAdminToken: z.string().min(1).optional(),
    nodeEnv: z
        .enum(["development", "test", "production"])
        .default("development")
});

export type DataConfig = z.infer<typeof dataConfigSchema>;

export function loadDataConfig(environment: NodeJS.ProcessEnv): DataConfig {
    return dataConfigSchema.parse({
        databaseUrl: environment.DATABASE_URL,
        corsOrigins: environment.CORS_ORIGINS ?? environment.CORS_ORIGIN,
        port: environment.PORT ?? environment.POMI_DATA_PORT,
        dataAdminToken: environment.POMI_DATA_ADMIN_TOKEN,
        nodeEnv: environment.NODE_ENV
    });
}
