import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { type IO, OutputBuilder } from "../BuildHandler.js";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    PaginationQueryType
} from "../pagination.js";
import { pathSeg } from "../PathSegment.js";
import { SpecBuilder } from "../SpecBuilder.js";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("class-schedules")];
const tags = ["class-schedules"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const classScheduleEntity = z
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
        classId: z.number().int(),
        roomCode: z.string(),
        classCode: z.string(),
        instituteId: z.number().int(),
        instituteCode: z.string(),
        courseId: z.number().int(),
        courseCode: z.string(),
        studyPeriodId: z.number().int(),
        studyPeriodCode: z.string(),
        _paths: z
            .object({
                entity: z.string(),
                studyPeriod: z.string(),
                institute: z.string(),
                course: z.string(),
                class: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("ClassScheduleEntity");

const daysOfWeekEnum = z
    .enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY"
    ])
    .openapi("DaysOfWeekEnum");

const classScheduleBase = z
    .object({
        id: z.number().int(),
        dayOfWeek: daysOfWeekEnum,
        start: z.string().min(1),
        end: z.string().min(1),
        roomId: z.number().int(),
        classId: z.number().int()
    })
    .strict();

const createClassScheduleBody = classScheduleBase
    .omit({ id: true })
    .openapi("CreateClassScheduleBody");

const patchClassScheduleBody = classScheduleBase
    .partial()
    .openapi("PatchClassScheduleBody");

const getClassSchedulesQuery = paginationQuerySchema
    .extend({
        studyPeriodId: z.coerce.number().int().optional(),
        studyPeriodCode: z.string().optional(),
        instituteId: z.coerce.number().int().optional(),
        instituteCode: z.string().optional(),
        courseId: z.coerce.number().int().optional(),
        courseCode: z.string().optional(),
        roomId: z.coerce.number().int().optional(),
        roomCode: z.string().optional(),
        classId: z.coerce.number().int().optional(),
        dayOfWeek: daysOfWeekEnum.optional()
    })
    .openapi("GetClassSchedulesQuery");

const ClassSchedulePageSchema =
    getPaginatedSchema(classScheduleEntity).openapi("PageClassSchedules");

const get = {
    specs: specsBuilder.get(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .ok(classScheduleEntity, "Class schedule retrieved successfully")
        .notFound()
        .build()
} satisfies IO;

const list = {
    specs: specsBuilder.list(),
    input: z.object({
        query: getClassSchedulesQuery
    }),
    output: new OutputBuilder()
        .ok(
            ClassSchedulePageSchema,
            "List of class schedules retrieved successfully"
        )
        .badRequest()
        .build()
} satisfies IO;

const create = {
    specs: specsBuilder.create(),
    input: z.object({
        body: createClassScheduleBody
    }),
    output: new OutputBuilder()
        .created(classScheduleEntity, "Class schedule created successfully")
        .badRequest()
        .build()
} satisfies IO;

const patch = {
    specs: specsBuilder.patch(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchClassScheduleBody
    }),
    output: new OutputBuilder()
        .ok(classScheduleEntity, "Class schedule updated successfully")
        .notFound()
        .badRequest()
        .build()
} satisfies IO;

const remove = {
    specs: specsBuilder.remove(),
    input: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    output: new OutputBuilder()
        .noContent("Class schedule deleted successfully")
        .notFound()
        .build()
} satisfies IO;

export default {
    schema: classScheduleEntity,
    get,
    list,
    create,
    patch,
    remove
};

export type ListQueryParams = {
    instituteId?: number;
    courseId?: number;
    studyPeriodId?: number;
    classId?: number;
} & Partial<PaginationQueryType>;
