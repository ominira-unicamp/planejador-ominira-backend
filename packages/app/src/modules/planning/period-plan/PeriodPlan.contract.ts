import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidPeriodPlanProblem } from "#/modules/planning/period-plan/PeriodPlan.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ReferenceNotFoundProblemSchema,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("period-plannings")
];
const tags = ["period-plannings"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const guideSchema = z
    .object({
        mode: z.enum(["CURRICULUM", "PROGRAM", "NONE"]),
        curriculumSource: z.enum(["SAVED", "SUGGESTION"]).nullable(),
        curriculumId: z.number().int().nullable(),
        suggestionId: z.number().int().nullable(),
        suggestionCatalogProgramId: z.number().int().nullable().optional(),
        catalogProgramId: z.number().int().nullable(),
        specializationId: z.number().int().nullable(),
        languageId: z.number().int().nullable(),
        manualCourseIds: z
            .array(z.number().int())
            .transform((arr) => [...new Set(arr)])
    })
    .strict();

const periodPlanningEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        name: z.string(),
        studyPeriodId: z.number().int(),
        studyPeriodYear: z.number().int(),
        studyPeriodYearPeriod: z.enum([
            "SUMMER",
            "FIRST_SEMESTER",
            "WINTER",
            "SECOND_SEMESTER"
        ]),
        curriculumId: z.number().int().nullable(),
        guide: guideSchema,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        classes: z.array(
            z
                .object({
                    id: z.number().int(),
                    code: z.string(),
                    reservations: z.array(z.number().int()),
                    courseId: z.number().int(),
                    courseCode: z.string(),
                    courseCredits: z.number(),
                    professors: z.array(
                        z
                            .object({
                                id: z.number().int(),
                                name: z.string()
                            })
                            .strict()
                    ),
                    classSchedules: z.array(
                        z
                            .object({
                                id: z.number().int(),
                                dayOfWeek: z.enum([
                                    "MONDAY",
                                    "TUESDAY",
                                    "WEDNESDAY",
                                    "THURSDAY",
                                    "FRIDAY",
                                    "SATURDAY",
                                    "SUNDAY"
                                ]),
                                start: z.string(),
                                end: z.string(),
                                roomId: z.number().int(),
                                roomCode: z.string()
                            })
                            .strict()
                    )
                })
                .strict()
        ),
        _paths: z
            .object({
                self: z.string(),
                student: z.string(),
                studyPeriod: z.string(),
                curriculum: z.string().nullable()
            })
            .strict()
    })
    .strict()
    .openapi("PeriodPlanningEntity");

const get = {
    meta: {
        ...specsBuilder.get(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(periodPlanningEntity, "Period planning retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_READ
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(
            z.array(periodPlanningEntity),
            "List of period plannings retrieved successfully"
        )
        .build()
} satisfies IO;

export const createBody = z
    .object({
        name: z.string().trim().min(1).optional(),
        studyPeriodId: z.number().int(),
        curriculumId: z.number().int().nullable().optional(),
        guide: guideSchema.optional(),
        classes: z.array(z.number().int()).transform((arr) => new Set(arr))
    })
    .strict();

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: createBody
    }),
    response: new OutputBuilder()
        .created(periodPlanningEntity, "Period planning created successfully")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidPeriodPlanProblem.schema
            ]),
            "Planejamento de semestre inválido"
        )
        .build()
} satisfies IO;

export const patchBody = z
    .object({
        name: z.string().trim().min(1).optional(),
        curriculumId: z.number().int().nullable().optional(),
        guide: guideSchema.optional(),
        classes: z
            .object({
                set: z.array(z.number().int()).transform((arr) => new Set(arr)),
                add: z.array(z.number().int()).transform((arr) => new Set(arr)),
                remove: z
                    .array(z.number().int())
                    .transform((arr) => new Set(arr))
            })
            .partial()
    })
    .strict();

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchBody
    }),
    response: new OutputBuilder()
        .ok(periodPlanningEntity, "Period planning updated successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Planejamento de semestre não encontrado"
        )
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidPeriodPlanProblem.schema
            ]),
            "Planejamento de semestre inválido"
        )
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.PLANNING_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .noContent("Period planning deleted successfully")
        .notFound()
        .build()
} satisfies IO;

function alias<Contract extends IO>(contract: Contract): Contract {
    return {
        ...contract,
        meta: {
            ...contract.meta,
            path: contract.meta.path.map((segment) =>
                segment.type === "literal" &&
                segment.value === "period-plannings"
                    ? pathSeg.literal("period-plan")
                    : segment
            )
        }
    };
}

export default {
    schema: periodPlanningEntity,
    get,
    list,
    create,
    patch,
    remove,
    aliases: {
        get: alias(get),
        list: alias(list),
        create: alias(create),
        patch: alias(patch),
        remove: alias(remove)
    }
};
