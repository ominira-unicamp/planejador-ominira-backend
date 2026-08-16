import type { PrismaClient } from "@pomi/db";

export type InjectionContext = {
    prisma: PrismaClient;
    inputPath: string;
    runId: string;
    signal?: AbortSignal;
};

export type InjectionFunction<TOptions> = (
    context: InjectionContext,
    options: TOptions
) => Promise<void>;
