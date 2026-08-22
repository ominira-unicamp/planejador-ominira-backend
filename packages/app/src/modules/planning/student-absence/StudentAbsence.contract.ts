import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidStudentAbsenceProblem } from "#/modules/planning/student-absence/StudentAbsence.problems.js";
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
    pathSeg.literal("absences")
];
const specsBuilder = new SpecBuilder(basePath, ["student-absences"], "id");

const dayOfWeekSchema = z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
]);

const absenceEntity = z
    .object({
        id: z.number().int(),
        studentCourseAttemptId: z.number().int(),
        classScheduleId: z.number().int(),
        date: z.string().date(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        studyPeriodId: z.number().int(),
        studyPeriodYear: z.number().int(),
        studyPeriodYearPeriod: z.enum([
            "SUMMER",
            "FIRST_SEMESTER",
            "WINTER",
            "SECOND_SEMESTER"
        ]),
        courseId: z.number().int(),
        courseCode: z.string(),
        classId: z.number().int(),
        classCode: z.string(),
        dayOfWeek: dayOfWeekSchema,
        start: z.string(),
        end: z.string(),
        _paths: z
            .object({
                self: z.string(),
                courseAttempt: z.string(),
                classSchedule: z.string(),
                class: z.string(),
                course: z.string(),
                studyPeriod: z.string()
            })
            .strict()
    })
    .strict()
    .openapi("StudentAbsence");

const absenceBody = z
    .object({
        courseAttemptId: z.number().int(),
        classScheduleId: z.number().int(),
        date: z.string().date()
    })
    .strict()
    .openapi("CreateStudentAbsenceBody");

const studentPath = z.object({
    sid: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});
const entityPath = studentPath.extend({
    id: z.string().pipe(z.coerce.number()).pipe(z.number().int())
});

const list = {
    meta: {
        ...specsBuilder.list(),
        authorization: policies.studentAccess(
            "sid",
            StudentCapabilities.HISTORY_READ
        )
    },
    request: z.object({
        path: studentPath,
        query: z.object({
            courseAttemptId: z
                .string()
                .pipe(z.coerce.number())
                .pipe(z.number().int())
                .optional()
        })
    }),
    response: new OutputBuilder()
        .ok(z.array(absenceEntity), "Faltas recuperadas com sucesso")
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
    request: z.object({ path: studentPath, body: absenceBody }),
    response: new OutputBuilder()
        .created(absenceEntity, "Falta registrada com sucesso")
        .problem(409, UniqueConstraintConflictProblemSchema, "Falta duplicada")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidStudentAbsenceProblem.schema
            ]),
            "Falta inválida"
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
    request: z.object({ path: entityPath }),
    response: new OutputBuilder()
        .noContent()
        .problem(404, ResourceNotFoundProblemSchema, "Falta não encontrada")
        .build()
} satisfies IO;

export default {
    schema: absenceEntity,
    list,
    create,
    remove
};
