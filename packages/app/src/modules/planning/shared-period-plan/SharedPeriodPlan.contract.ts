import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { periodPlanningClass } from "#/modules/planning/period-plan/PeriodPlan.contract.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const sharedPeriodPlanning = z
    .object({
        shareId: z.string().uuid(),
        name: z.string(),
        visibility: z.enum(["FRIENDS", "PUBLIC"]),
        studyPeriodId: z.number().int(),
        studyPeriodYear: z.number().int(),
        studyPeriodYearPeriod: z.enum([
            "SUMMER",
            "FIRST_SEMESTER",
            "WINTER",
            "SECOND_SEMESTER"
        ]),
        owner: z
            .object({
                publicId: z.string().uuid(),
                displayName: z.string()
            })
            .strict()
            .nullable(),
        classes: z.array(periodPlanningClass),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime()
    })
    .strict()
    .openapi("SharedPeriodPlanning");

const publicPath = [pathSeg.literal("shared-period-plannings")];
const studentPath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("shared-period-plannings")
];
const publicQuery = z.object({
    page: z
        .string()
        .pipe(z.coerce.number())
        .pipe(z.number().int().min(1))
        .default(1),
    pageSize: z
        .string()
        .pipe(z.coerce.number())
        .pipe(z.number().int().min(1).max(50))
        .default(20),
    studyPeriodId: z
        .string()
        .pipe(z.coerce.number())
        .pipe(z.number().int())
        .optional(),
    query: z.string().trim().min(1).optional()
});
const sidPath = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const sharePath = z.object({ shareId: z.string().uuid() });

const listPublic = {
    meta: {
        method: "get" as const,
        path: publicPath,
        tags: ["shared-period-plannings"],
        authorization: policies.public
    },
    request: z.object({ query: publicQuery }),
    response: new OutputBuilder()
        .ok(
            z
                .object({
                    items: z.array(sharedPeriodPlanning),
                    page: z.number().int(),
                    pageSize: z.number().int(),
                    total: z.number().int()
                })
                .strict(),
            "Planejamentos públicos recuperados"
        )
        .build()
} satisfies IO;

const getPublic = {
    meta: {
        method: "get" as const,
        path: [...publicPath, pathSeg.param("shareId")],
        tags: ["shared-period-plannings"],
        authorization: policies.public
    },
    request: z.object({ path: sharePath }),
    response: new OutputBuilder()
        .ok(sharedPeriodPlanning, "Planejamento público recuperado")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Planejamento não encontrado"
        )
        .build()
} satisfies IO;

const listForStudent = {
    meta: {
        method: "get" as const,
        path: studentPath,
        tags: ["shared-period-plannings"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({
        path: sidPath,
        query: z.object({
            page: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().min(1))
                .default(1),
            pageSize: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int().min(1).max(50))
                .default(20)
        })
    }),
    response: new OutputBuilder()
        .ok(
            z
                .object({
                    items: z.array(sharedPeriodPlanning),
                    page: z.number().int(),
                    pageSize: z.number().int(),
                    total: z.number().int()
                })
                .strict(),
            "Planejamentos compartilhados recuperados"
        )
        .build()
} satisfies IO;

const getForStudent = {
    meta: {
        method: "get" as const,
        path: [...studentPath, pathSeg.param("shareId")],
        tags: ["shared-period-plannings"],
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({ path: sidPath.extend(sharePath.shape) }),
    response: new OutputBuilder()
        .ok(sharedPeriodPlanning, "Planejamento compartilhado recuperado")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Planejamento não encontrado"
        )
        .build()
} satisfies IO;

export default {
    schema: sharedPeriodPlanning,
    listPublic,
    getPublic,
    listForStudent,
    getForStudent,
    specsBuilder: new SpecBuilder(
        publicPath,
        ["shared-period-plannings"],
        "shareId"
    )
};
