import {
    JobRequestStatus,
    JobRequestTrigger,
    JobRequestType,
    Prisma,
    type JobRequest,
    type PrismaClient
} from "../prisma/generated/client.js";

export type JobRequestMode = "all" | "obtain" | "inject";

export type EnqueueJobInput = Readonly<{
    type: JobRequestType;
    name: string;
    mode?: JobRequestMode;
    trigger: JobRequestTrigger;
    availableAt?: Date;
    scheduledFor?: Date;
    deduplicationKey?: string;
    requestedBy?: string;
    parentJobId?: string;
    partitionKey?: string;
    parameters?: Record<string, unknown>;
}>;

export async function enqueueJob(
    prisma: PrismaClient,
    input: EnqueueJobInput
): Promise<JobRequest> {
    const active = await prisma.jobRequest.findFirst({
        where: {
            type: input.type,
            name: input.name,
            partitionKey: input.partitionKey,
            status: { in: [JobRequestStatus.QUEUED, JobRequestStatus.RUNNING] }
        }
    });
    if (active)
        throw new Error(
            `Já existe um job ${input.name} em execução ou aguardando: ${active.id}`
        );
    return prisma.jobRequest.create({
        data: {
            type: input.type,
            name: input.name,
            parentJobId: input.parentJobId,
            partitionKey: input.partitionKey,
            parameters: input.parameters as Prisma.InputJsonValue,
            mode: input.mode,
            trigger: input.trigger,
            availableAt: input.availableAt,
            scheduledFor: input.scheduledFor,
            deduplicationKey: input.deduplicationKey,
            requestedBy: input.requestedBy
        }
    });
}

export async function claimNextJob(
    prisma: PrismaClient,
    type: JobRequestType
): Promise<JobRequest | null> {
    const next = await prisma.jobRequest.findFirst({
        where: {
            type,
            status: JobRequestStatus.QUEUED,
            availableAt: { lte: new Date() }
        },
        orderBy: [
            { trigger: "asc" },
            { availableAt: "asc" },
            { createdAt: "asc" }
        ]
    });
    if (!next) return null;
    const claimed = await prisma.jobRequest.updateMany({
        where: { id: next.id, status: JobRequestStatus.QUEUED },
        data: { status: JobRequestStatus.RUNNING, startedAt: new Date() }
    });
    return claimed.count === 1
        ? prisma.jobRequest.findUnique({ where: { id: next.id } })
        : null;
}

export async function finishJob(
    prisma: PrismaClient,
    id: string,
    result: Readonly<{ runId?: string; errorMessage?: string }>
) {
    return prisma.jobRequest.update({
        where: { id },
        data: {
            status: result.errorMessage
                ? JobRequestStatus.FAILED
                : JobRequestStatus.SUCCEEDED,
            runId: result.runId,
            errorMessage: result.errorMessage,
            finishedAt: new Date()
        }
    });
}

export { JobRequestStatus, JobRequestTrigger, JobRequestType };
