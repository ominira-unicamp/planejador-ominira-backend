import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidStudentCourseAttemptProblem } from "#/modules/planning/student-course-attempt/StudentCourseAttempt.problems.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
    pathSeg,
    ReferenceNotFoundProblemSchema,
    ResourceNotFoundProblemSchema,
    SpecBuilder,
    UniqueConstraintConflictProblemSchema
} from "@pomi/api-core";
import z from "zod";

extendZodWithOpenApi(z);

const basePath = [
    pathSeg.literal("student"),
    pathSeg.param("sid"),
    pathSeg.literal("course-attempts")
];
const tags = ["student-course-attempts"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

export const StudentCourseAttemptStatus = {
    ENROLLED: "ENROLLED",
    DROPPED: "DROPPED",
    APPROVED: "APPROVED",
    FAILED_BY_GRADE: "FAILED_BY_GRADE",
    APPROVED_BY_ATTENDANCE: "APPROVED_BY_ATTENDANCE",
    FAILED_BY_ATTENDANCE: "FAILED_BY_ATTENDANCE",
    SUFFICIENT: "SUFFICIENT",
    INSUFFICIENT: "INSUFFICIENT"
} as const;

export const statusSchema = z.enum([
    "ENROLLED",
    "DROPPED",
    "APPROVED",
    "FAILED_BY_GRADE",
    "APPROVED_BY_ATTENDANCE",
    "FAILED_BY_ATTENDANCE",
    "SUFFICIENT",
    "INSUFFICIENT"
]);
const evaluationModeSchema = z.enum([
    "GRADE_AND_ATTENDANCE",
    "ATTENDANCE",
    "CONCEPT"
]);
const gradeSchema = z.number().min(0).max(10).nullable();

const attemptEntity = z
    .object({
        id: z.number().int(),
        studentId: z.number().int(),
        courseId: z.number().int(),
        studyPeriodId: z.number().int().nullable(),
        classId: z.number().int().nullable(),
        evaluationMode: evaluationModeSchema,
        status: statusSchema,
        grade: z.number().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        course: z.object({
            id: z.number().int(),
            code: z.string(),
            name: z.string(),
            credits: z.number().int(),
            unit: z
                .object({ id: z.number().int(), code: z.string() })
                .nullable()
        }),
        studyPeriod: z
            .object({
                id: z.number().int(),
                code: z.string(),
                year: z.number().int(),
                yearPeriod: z.enum([
                    "SUMMER",
                    "FIRST_SEMESTER",
                    "WINTER",
                    "SECOND_SEMESTER"
                ])
            })
            .nullable(),
        class: z
            .object({
                id: z.number().int(),
                code: z.string(),
                professors: z.array(
                    z.object({ id: z.number().int(), name: z.string() })
                )
            })
            .nullable(),
        _paths: z.object({
            self: z.string(),
            student: z.string(),
            course: z.string(),
            studyPeriod: z.string().nullable(),
            class: z.string().nullable()
        })
    })
    .strict()
    .openapi("StudentCourseAttempt");

const attemptBody = z
    .object({
        courseId: z.number().int(),
        studyPeriodId: z.number().int().nullable().optional(),
        classId: z.number().int().nullable().optional(),
        evaluationMode: evaluationModeSchema.optional(),
        status: statusSchema,
        grade: gradeSchema.optional()
    })
    .strict();

const get = {
    meta: {
        ...specsBuilder.get(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_READ
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(attemptEntity, "Student course attempt retrieved successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Tentativa de disciplina não encontrada"
        )
        .build()
} satisfies IO;

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_READ
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        query: z.object({
            status: statusSchema.optional(),
            courseId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number())
                .optional(),
            studyPeriodId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number())
                .optional()
        })
    }),
    response: new OutputBuilder()
        .ok(
            z.array(attemptEntity),
            "Student course attempts retrieved successfully"
        )
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: attemptBody
    }),
    response: new OutputBuilder()
        .created(attemptEntity, "Student course attempt created successfully")
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Tentativa cursando já existente"
        )
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidStudentCourseAttemptProblem.schema
            ]),
            "Tentativa de disciplina inválida"
        )
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: attemptBody.omit({ courseId: true }).partial().strict()
    }),
    response: new OutputBuilder()
        .ok(attemptEntity, "Student course attempt updated successfully")
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Tentativa de disciplina não encontrada"
        )
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Tentativa cursando já existente"
        )
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidStudentCourseAttemptProblem.schema
            ]),
            "Tentativa de disciplina inválida"
        )
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_WRITE
        )
    },
    request: z.object({
        path: z.object({
            sid: z.string().pipe(z.coerce.number()).pipe(z.number()),
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .noContent()
        .problem(
            404,
            ResourceNotFoundProblemSchema,
            "Tentativa de disciplina não encontrada"
        )
        .build()
} satisfies IO;

export default {
    schema: attemptEntity,
    statusSchema,
    get,
    list,
    create,
    patch,
    remove
};
