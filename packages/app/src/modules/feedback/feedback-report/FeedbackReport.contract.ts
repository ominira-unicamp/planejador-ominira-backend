import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import {
    FeedbackRateLimitProblem,
    InvalidFeedbackReportProblem
} from "#/modules/feedback/feedback-report/FeedbackReport.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { pathSeg, ReferenceNotFoundProblemSchema } from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

export const feedbackFeatureKeys = [
    "home",
    "curriculum-planner",
    "semester-planner",
    "course-situation",
    "agenda",
    "social",
    "academic-data"
] as const;

export const feedbackAcademicResourceTypes = [
    "COURSE",
    "CATALOG_COURSE",
    "CATALOG_PROGRAM",
    "CURRICULUM_SUGGESTION",
    "CLASS",
    "CLASS_SCHEDULE",
    "STUDY_PERIOD",
    "DAILY_MENU",
    "CALENDAR_EVENT"
] as const;

const feedbackPath = [pathSeg.literal("feedback-reports")];
const studentFeedbackPath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("feedback-reports")
];

const studentPath = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});

const target = z
    .discriminatedUnion("type", [
        z.object({ type: z.literal("GENERAL") }).strict(),
        z
            .object({
                type: z.literal("FEATURE"),
                featureKey: z.enum(feedbackFeatureKeys)
            })
            .strict(),
        z
            .object({
                type: z.literal("ACADEMIC_RESOURCE"),
                academicResourceType: z.enum(feedbackAcademicResourceTypes),
                academicResourceId: z.number().int().positive()
            })
            .strict()
    ])
    .openapi("FeedbackReportTarget");

const body = z
    .object({
        kind: z.enum(["BUG", "SUGGESTION", "DATA_ISSUE"]),
        target,
        title: z.string().trim().min(5).max(160),
        description: z.string().trim().min(20).max(5000),
        sourcePath: z
            .string()
            .max(300)
            .regex(/^\/(?:[^?#]*)$/)
            .optional()
    })
    .strict()
    .openapi("CreateFeedbackReportBody");

const accepted = z
    .object({ createdAt: z.string().datetime() })
    .strict()
    .openapi("FeedbackReportAccepted");

const createAnonymous = {
    meta: {
        method: "post" as const,
        path: feedbackPath,
        tags: ["feedback-reports"],
        authorization: policies.public
    },
    request: z.object({ body }),
    response: new OutputBuilder()
        .created(accepted, "Feedback recebido")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidFeedbackReportProblem.schema
            ]),
            "Feedback inválido"
        )
        .problem(429, FeedbackRateLimitProblem.schema, "Muitos envios")
        .build()
} satisfies IO;

const createForStudent = {
    meta: {
        method: "post" as const,
        path: studentFeedbackPath,
        tags: ["feedback-reports"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.FEEDBACK_WRITE
        )
    },
    request: z.object({ path: studentPath, body }),
    response: new OutputBuilder()
        .created(accepted, "Feedback recebido")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidFeedbackReportProblem.schema
            ]),
            "Feedback inválido"
        )
        .build()
} satisfies IO;

export default { body, createAnonymous, createForStudent };
