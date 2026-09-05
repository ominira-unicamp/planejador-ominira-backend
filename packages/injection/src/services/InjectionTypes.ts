import type { PrismaClient } from "@pomi/db";
import type { InjectionAuditContext } from "../audit-context.js";
import type { InjectionLogger } from "../logger.js";

export type InjectionContext = {
    prisma: PrismaClient;
    inputPath: string;
    runId: string;
    auditContext: InjectionAuditContext;
    logger: InjectionLogger;
    signal?: AbortSignal;
};

export type InjectionFunction<TOptions> = (
    context: InjectionContext,
    options: TOptions
) => Promise<void>;
