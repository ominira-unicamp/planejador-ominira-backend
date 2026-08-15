import { type IO, OutputBuilder } from "#/BuildHandler.js";
import { Capabilities, policies } from "#/auth.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    getPaginatedSchema,
    InvalidRequestProblemSchema,
    paginationQuerySchema,
    PaginationQueryType,
    pathSeg,
    ReferenceNotFoundProblemSchema,
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
        studyPeriodCode: z.string()
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

const _create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        body: createClassScheduleBody
    }),
    response: new OutputBuilder()
        .created(classScheduleEntity, "Class schedule created successfully")
        .problem(400, InvalidRequestProblemSchema, "Dados inválidos")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Referência não encontrada"
        )
        .build()
} satisfies IO;

const _patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchClassScheduleBody
    }),
    response: new OutputBuilder()
        .ok(classScheduleEntity, "Class schedule updated successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Horário de turma não encontrado"
        )
        .problem(400, InvalidRequestProblemSchema, "Dados inválidos")
        .problem(
            422,
            ReferenceNotFoundProblemSchema,
            "Referência não encontrada"
        )
        .build()
} satisfies IO;

const _remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.capability(Capabilities.ACADEMIC_WRITE)
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .noContent("Class schedule deleted successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Horário de turma não encontrado"
        )
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
export type CreateClassScheduleInput = z.infer<typeof createClassScheduleBody>;
export type PatchClassScheduleInput = z.infer<typeof patchClassScheduleBody>;

export const classSchedulePaths = {
    entity: (id: number) => `/class-schedules/${id}`
};
