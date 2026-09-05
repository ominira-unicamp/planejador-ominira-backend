import { validateCronExpression } from "@pomi/api-core";
import z from "zod";

const configSchema = z.object({
    databaseUrl: z.string().min(1),
    appApiUrl: z.string().url(),
    frontendUrl: z.string().url(),
    unsubscribeSecret: z.string().min(32),
    cron: z
        .string()
        .trim()
        .default("0 */6 * * *")
        .transform((expression) => validateCronExpression(expression)),
    pollIntervalMs: z.coerce.number().int().min(1_000).default(5_000),
    maxAttempts: z.coerce.number().int().min(1).max(20).default(5),
    smtpHost: z.string().min(1),
    smtpPort: z.coerce.number().int().min(1).max(65_535).default(587),
    smtpUser: z.string().min(1),
    smtpPass: z.string().min(1),
    smtpFrom: z.string().min(1),
    logLevel: z.string().default("info")
});

export type NotifierConfig = z.infer<typeof configSchema>;

export function loadNotifierConfig(
    environment: NodeJS.ProcessEnv
): NotifierConfig {
    return configSchema.parse({
        databaseUrl: environment.DATABASE_URL,
        appApiUrl: environment.POMI_APP_API_URL,
        frontendUrl: environment.POMI_FRONTEND_URL,
        unsubscribeSecret: environment.NOTIFIER_UNSUBSCRIBE_SECRET,
        cron: environment.NOTIFIER_CRON,
        pollIntervalMs: environment.NOTIFIER_POLL_INTERVAL_MS,
        maxAttempts: environment.NOTIFIER_MAX_ATTEMPTS,
        smtpHost: environment.SMTP_HOST,
        smtpPort: environment.SMTP_PORT,
        smtpUser: environment.SMTP_USER,
        smtpPass: environment.SMTP_PASS,
        smtpFrom: environment.SMTP_FROM ?? environment.SMTP_USER,
        logLevel: environment.LOG_LEVEL
    });
}
