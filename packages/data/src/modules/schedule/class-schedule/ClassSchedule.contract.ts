import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { policies } from "#/auth.js";
import {
    equalityOperators,
    type Filter,
    filterDefinition,
    type FilterValue,
    resourceFilterSchema
} from "#/queryFilterDefinitions.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    paginationQuerySchema,
    PaginationQueryType,
    pathSeg,
    ResourceNotFoundProblemSchema,
    serializeQueryParams,
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

export type ClassScheduleFilterValue = FilterValue;
export type ClassScheduleFilter = Filter;

const classScheduleFilterDefinitions = {
    "dayOfWeek": filterDefinition.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY"
    ]),
    "room.id": filterDefinition.id(),
    "room.code": filterDefinition.code({
        nonEmpty: false,
        operators: equalityOperators
    }),
    "class.id": filterDefinition.id(),
    "course.id": filterDefinition.id(),
    "course.code": filterDefinition.code({
        nonEmpty: false,
        operators: equalityOperators
    }),
    "unit.id": filterDefinition.id(),
    "unit.code": filterDefinition.code({
        nonEmpty: false,
        operators: equalityOperators
    }),
    "studyPeriod.id": filterDefinition.id(),
    "studyPeriod.year": filterDefinition.integer(),
    "studyPeriod.yearPeriod": filterDefinition.enum([
        "SUMMER",
        "FIRST_SEMESTER",
        "WINTER",
        "SECOND_SEMESTER"
    ])
};

const classScheduleFilter = resourceFilterSchema(
    classScheduleFilterDefinitions,
    "class schedules",
    "Structured class schedule filters. Use bracket notation such as filter[course][code]=MC102."
);

const getClassSchedulesQuery = paginationQuerySchema
    .extend({
        filter: classScheduleFilter.optional()
    })
    .strict()
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
    meta: {
        ...specsBuilder.list(),
        authorization: policies.public,
        queryFeatures: { filter: true }
    },
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

export type ListQueryParams = Partial<PaginationQueryType>;
export type ClassScheduleListInput = z.infer<typeof getClassSchedulesQuery>;

export const classSchedulePaths = {
    list: (query: Partial<ClassScheduleListInput> = {}) => {
        const search = serializeQueryParams(
            query as unknown as Record<string, unknown>
        );
        return `/class-schedules${search ? `?${search}` : ""}`;
    },
    entity: (id: number) => `/class-schedules/${id}`
};
