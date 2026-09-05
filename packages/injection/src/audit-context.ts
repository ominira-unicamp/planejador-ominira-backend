import { type Prisma, type PrismaClient } from "@pomi/db";

export type InjectionAuditContext = {
    source: "injection";
    runId: string;
    injectionName: string;
    mode: "all" | "inject";
    jobId?: string;
    trigger?: "MANUAL" | "SCHEDULED";
    requestedBy?: string;
};

export async function withAuditTransaction<T>(
    prisma: PrismaClient,
    auditContext: InjectionAuditContext,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: Readonly<{ timeout?: number; maxWait?: number }>
) {
    return prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
            SELECT set_config('pomi.audit_context', ${JSON.stringify(auditContext)}, true)
        `;
        return operation(transaction);
    }, options);
}
