import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../../BuildHandler.js";
import { pathSeg } from "../../PathSegment.js";
import { SpecBuilder } from "../../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("period-plannings")
];
const tags = ["period-plannings"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const periodPlanningEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        studyPeriodId: z.number().int(),
        studyPeriodCode: z.string(),
        classes: z.array(
            z
                .object({
                    id: z.number().int(),
                    code: z.string(),
                    reservations: z.array(z.number().int()),
                    courseId: z.number().int(),
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
                studyPeriod: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("PeriodPlanningEntity");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(periodPlanningEntity, "Period planning retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(
            z.array(periodPlanningEntity),
            "List of period plannings retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                studyPeriodId: z.number().int(),
                classes: z
                    .array(z.number().int())
                    .transform((arr) => new Set(arr))
            })
            .strict()
    }),
    output: new OutputBuilder()
        .created(periodPlanningEntity, "Period planning created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                classes: z
                    .object({
                        set: z
                            .array(z.number().int())
                            .transform((arr) => new Set(arr)),
                        add: z
                            .array(z.number().int())
                            .transform((arr) => new Set(arr)),
                        remove: z
                            .array(z.number().int())
                            .transform((arr) => new Set(arr))
                    })
                    .partial()
            })
            .strict()
    }),
    output: new OutputBuilder()
        .ok(periodPlanningEntity, "Period planning updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Period planning deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: periodPlanningEntity,
    get,
    list,
    create,
    patch,
    remove
};
