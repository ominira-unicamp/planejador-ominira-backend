import type { FeedbackRateLimiter } from "#/modules/feedback/feedback-report/FeedbackRateLimiter.js";
import IO from "#/modules/feedback/feedback-report/FeedbackReport.contract.js";
import {
    feedbackRateLimitProblem,
    feedbackReferenceNotFoundProblem,
    feedbackReportNotFoundProblem,
    type FeedbackReportProblem
} from "#/modules/feedback/feedback-report/FeedbackReport.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { FeedbackReportStatus, PrismaClient } from "@pomi/db";
import z from "zod";

type Input = z.infer<typeof IO.body>;
type Report = z.infer<typeof IO.schemas.report>;
type AdminPatchInput = z.infer<typeof IO.patchAdmin.request>["body"];
type Receipt = { createdAt: string };

function buildReport(report: {
    id: number;
    kind: "BUG" | "SUGGESTION" | "DATA_ISSUE";
    targetType: "GENERAL" | "FEATURE" | "ACADEMIC_RESOURCE";
    featureKey: string | null;
    academicResourceType: string | null;
    academicResourceId: number | null;
    title: string;
    description: string;
    sourcePath: string | null;
    status: FeedbackReportStatus;
    adminMessage: string | null;
    reporterStudentId: number | null;
    createdAt: Date;
    updatedAt: Date;
}): Report {
    const target =
        report.targetType === "GENERAL"
            ? { type: "GENERAL" as const }
            : report.targetType === "FEATURE"
              ? {
                    type: "FEATURE" as const,
                    featureKey: report.featureKey as Report["target"] extends {
                        type: "FEATURE";
                        featureKey: infer FeatureKey;
                    }
                        ? FeatureKey
                        : never
                }
              : {
                    type: "ACADEMIC_RESOURCE" as const,
                    academicResourceType:
                        report.academicResourceType as Report["target"] extends {
                            type: "ACADEMIC_RESOURCE";
                            academicResourceType: infer ResourceType;
                        }
                            ? ResourceType
                            : never,
                    academicResourceId: report.academicResourceId!
                };
    return {
        id: report.id,
        kind: report.kind,
        target,
        title: report.title,
        description: report.description,
        sourcePath: report.sourcePath,
        status: report.status,
        adminMessage: report.adminMessage,
        reporterStudentId: report.reporterStudentId,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
    } as Report;
}

const reportSelection = {
    id: true,
    kind: true,
    targetType: true,
    featureKey: true,
    academicResourceType: true,
    academicResourceId: true,
    title: true,
    description: true,
    sourcePath: true,
    status: true,
    adminMessage: true,
    reporterStudentId: true,
    createdAt: true,
    updatedAt: true
} as const;

async function academicResourceExists(
    prisma: PrismaClient,
    type: Extract<
        Input["target"],
        { type: "ACADEMIC_RESOURCE" }
    >["academicResourceType"],
    id: number
) {
    switch (type) {
        case "COURSE":
            return Boolean(
                await prisma.course.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CATALOG_COURSE":
            return Boolean(
                await prisma.catalogCourse.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CATALOG_PROGRAM":
            return Boolean(
                await prisma.catalogProgram.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CURRICULUM_SUGGESTION":
            return Boolean(
                await prisma.curriculumSuggestion.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CLASS":
            return Boolean(
                await prisma.class.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CLASS_SCHEDULE":
            return Boolean(
                await prisma.classSchedule.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "STUDY_PERIOD":
            return Boolean(
                await prisma.studyPeriod.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "DAILY_MENU":
            return Boolean(
                await prisma.dailyMenu.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
        case "CALENDAR_EVENT":
            return Boolean(
                await prisma.calendarEvent.findUnique({
                    where: { id },
                    select: { id: true }
                })
            );
    }
}

async function validateAcademicResource(prisma: PrismaClient, input: Input) {
    if (input.target.type !== "ACADEMIC_RESOURCE") return undefined;
    const found = await academicResourceExists(
        prisma,
        input.target.academicResourceType,
        input.target.academicResourceId
    );
    if (found) return undefined;
    return feedbackReferenceNotFoundProblem([
        {
            code: "REFERENCE_NOT_FOUND",
            path: ["target", "academicResourceId"],
            message: "O dado acadêmico informado não foi encontrado."
        }
    ]);
}

export type FeedbackReportService = {
    createAnonymous(
        input: Input,
        requestIp: string
    ): Promise<Result<Receipt, FeedbackReportProblem>>;
    createForStudent(
        studentId: number,
        input: Input
    ): Promise<
        Result<
            Receipt,
            Exclude<
                FeedbackReportProblem,
                ReturnType<typeof feedbackRateLimitProblem>
            >
        >
    >;
    listForStudent(studentId: number): Promise<Report[]>;
    listForAdmin(): Promise<Report[]>;
    patchAdmin(
        id: number,
        input: AdminPatchInput
    ): Promise<
        Result<Report, ReturnType<typeof feedbackReportNotFoundProblem>>
    >;
};

export function createFeedbackReportService({
    prisma,
    feedbackRateLimiter
}: {
    prisma: PrismaClient;
    feedbackRateLimiter: FeedbackRateLimiter;
}): FeedbackReportService {
    const create = async (input: Input, reporterStudentId?: number) => {
        const invalidReference = await validateAcademicResource(prisma, input);
        if (invalidReference) return err(invalidReference);
        const report = await prisma.feedbackReport.create({
            data: {
                kind: input.kind,
                targetType: input.target.type,
                featureKey:
                    input.target.type === "FEATURE"
                        ? input.target.featureKey
                        : null,
                academicResourceType:
                    input.target.type === "ACADEMIC_RESOURCE"
                        ? input.target.academicResourceType
                        : null,
                academicResourceId:
                    input.target.type === "ACADEMIC_RESOURCE"
                        ? input.target.academicResourceId
                        : null,
                title: input.title,
                description: input.description,
                sourcePath: input.sourcePath ?? null,
                reporterStudentId: reporterStudentId ?? null
            },
            select: { createdAt: true }
        });
        return ok({ createdAt: report.createdAt.toISOString() });
    };

    return {
        async createAnonymous(input, requestIp) {
            const limit = feedbackRateLimiter.consume(requestIp);
            if (!limit.allowed)
                return err(feedbackRateLimitProblem(limit.retryAfterSeconds));
            return create(input);
        },
        async createForStudent(studentId, input) {
            return create(input, studentId);
        },
        async listForStudent(studentId) {
            const reports = await prisma.feedbackReport.findMany({
                where: { reporterStudentId: studentId },
                select: reportSelection,
                orderBy: { createdAt: "desc" }
            });
            return reports.map(buildReport);
        },
        async listForAdmin() {
            const reports = await prisma.feedbackReport.findMany({
                select: reportSelection,
                orderBy: { createdAt: "desc" }
            });
            return reports.map(buildReport);
        },
        async patchAdmin(id, input) {
            const existing = await prisma.feedbackReport.findUnique({
                where: { id },
                select: { id: true }
            });
            if (!existing) return err(feedbackReportNotFoundProblem());
            const report = await prisma.feedbackReport.update({
                where: { id },
                data: {
                    ...(input.status ? { status: input.status } : {}),
                    ...(input.adminMessage !== undefined
                        ? { adminMessage: input.adminMessage }
                        : {})
                },
                select: reportSelection
            });
            return ok(buildReport(report));
        }
    };
}
