import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    PaginationQueryType,
    pathSeg,
    ResourceNotFoundProblemSchema,
    SpecBuilder
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [pathSeg.literal("class-schedules")];
const tags = ["class-schedules"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const classScheduleDataSchema = z
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
        unitId: z.number().int(),
        unitCode: z.string(),
        courseId: z.number().int(),
        courseCode: z.string(),
        studyPeriodId: z.number().int(),
        studyPeriodCode: z.string(),
        studyPeriodYear: z.number().int(),
        studyPeriodYearPeriod: z.enum([
            "SUMMER",
            "FIRST_SEMESTER",
            "WINTER",
            "SECOND_SEMESTER"
        ])
    })
    .strict()
    .openapi("ClassScheduleData");

export const classScheduleEntity = classScheduleDataSchema
    .extend({
        _paths: z
            .object({
                entity: z.string(),
                studyPeriod: z.string(),
                unit: z.string(),
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

const getClassSchedulesQuery = paginationQuerySchema
    .extend({
        studyPeriodId: z.coerce.number().int().optional(),
        studyPeriodCode: z.string().optional(),
        studyPeriodYear: z.coerce.number().int().optional(),
        studyPeriodYearPeriod: z
            .enum(["SUMMER", "FIRST_SEMESTER", "WINTER", "SECOND_SEMESTER"])
            .optional(),
        unitId: z.coerce.number().int().optional(),
        unitCode: z.string().optional(),
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
    meta: { ...specsBuilder.get(), authorization: policies.public },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(classScheduleEntity, "Class schedule retrieved successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Horário de turma não encontrado"
        )
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.public },
    request: z.object({
        query: getClassSchedulesQuery
    }),
    response: new OutputBuilder()
        .ok(
            ClassSchedulePageSchema,
            "List of class schedules retrieved successfully"
        )
        .badRequest()
        .build()
} satisfies IO;

const contracts = {
    get,
    list
};

export default contracts;

export type ListQueryParams = {
    unitId?: number;
    courseId?: number;
    studyPeriodId?: number;
    classId?: number;
} & Partial<PaginationQueryType>;
export type ClassScheduleListInput = z.infer<typeof getClassSchedulesQuery>;

export const classSchedulePaths = {
    entity: (id: number) => `/class-schedules/${id}`
};
