import type { PrismaClient } from "@pomi/db";
import type { InjectionLogger } from "../logger.js";

export type InjectionContext = {
    prisma: PrismaClient;
    inputPath: string;
    runId: string;
    logger: InjectionLogger;
    signal?: AbortSignal;
};

export type InjectionFunction<TOptions> = (
    context: InjectionContext,
    options: TOptions
) => Promise<void>;
