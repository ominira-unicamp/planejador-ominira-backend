import { policies, StudentCapabilities } from "#/Authorization.js";
import { type IO, OutputBuilder } from "#/Contract.js";
import { InvalidStudentProfileProblem } from "#/modules/planning/student/Student.problems.js";
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

const basePath = [pathSeg.literal("students")];
const tags = ["students"];
const specsBuilder = new SpecBuilder(basePath, tags, "id");

const studentEntity = z
    .object({
        id: z.number().int(),
        ra: z.string(),
        name: z.string(),
        programId: z.number().int().nullable(),
        specializationId: z.number().int().nullable(),
        catalogId: z.number().int().nullable(),
        entryYear: z.number().int().min(1900).max(9999).nullable(),
        languageId: z.number().int().nullable(),
        _paths: z.object({
            classes: z.string(),
            classSchedules: z.string()
        })
    })
    .strict()
    .openapi("StudentEntity");

const studentBase = z
    .object({
        id: z.number().int(),
        ra: z.string(),
        name: z.string(),
        programId: z.number().int().nullable().optional(),
        specializationId: z.number().int().nullable().optional(),
        catalogId: z.number().int().nullable().optional(),
        entryYear: z.number().int().min(1900).max(9999).nullable().optional(),
        languageId: z.number().int().nullable().optional()
    })
    .strict();

const createStudentBody = studentBase
    .omit({ id: true, ra: true })
    .openapi("CreateStudentBody");

const patchStudentBody = studentBase
    .omit({ id: true })
    .partial()
    .strict()
    .openapi("PatchStudentBody");

const get = {
    meta: {
        ...specsBuilder.get(),
        authorization: policies.studentAccess(
            "id",
            StudentCapabilities.PROFILE_READ
        )
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        })
    }),
    response: new OutputBuilder()
        .ok(studentEntity, "Student retrieved successfully")
        .problem(404, ResourceNotFoundProblemSchema, "Aluno não encontrado")
        .build()
} satisfies IO;

const list = {
    meta: { ...specsBuilder.list(), authorization: policies.admin },
    request: z.object({}),
    response: new OutputBuilder()
        .ok(z.array(studentEntity), "List of students retrieved successfully")
        .build()
} satisfies IO;

const create = {
    meta: {
        ...specsBuilder.create(),
        authorization: policies.studentRegistration
    },
    request: z.object({
        body: createStudentBody
    }),
    response: new OutputBuilder()
        .ok(studentEntity, "Existing student linked successfully")
        .created(studentEntity, "Student created successfully")
        .problem(
            409,
            UniqueConstraintConflictProblemSchema,
            "Conflito de identidade do aluno"
        )
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidStudentProfileProblem.schema
            ]),
            "Perfil de aluno inválido"
        )
        .build()
} satisfies IO;

const patch = {
    meta: {
        ...specsBuilder.patch(),
        authorization: policies.studentAccess(
            "id",
            StudentCapabilities.PROFILE_WRITE
        )
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: patchStudentBody
    }),
    response: new OutputBuilder()
        .ok(studentEntity, "Student updated successfully")
        .problem(404, ResourceNotFoundProblemSchema, "Aluno não encontrado")
        .problem(
            422,
            z.discriminatedUnion("type", [
                ReferenceNotFoundProblemSchema,
                InvalidStudentProfileProblem.schema
            ]),
            "Perfil de aluno inválido"
        )
        .build()
} satisfies IO;

const remove = {
    meta: {
        ...specsBuilder.remove(),
        authorization: policies.studentAccess(
            "id",
            StudentCapabilities.PROFILE_WRITE
        )
    },
    request: z.object({
        path: z.object({
            id: z.string().pipe(z.coerce.number()).pipe(z.number())
        }),
        body: z
            .object({
                confirmationRa: z.string().regex(/^\d{6}$/)
            })
            .strict()
    }),
    response: new OutputBuilder()
        .noContent("Student deleted successfully")
        .problem(404, ResourceNotFoundProblemSchema, "Aluno não encontrado")
        .problem(
            422,
            InvalidStudentProfileProblem.schema,
            "Confirmação inválida"
        )
        .build()
} satisfies IO;

export default {
    schema: studentEntity,
    get,
    list,
    create,
    patch,
    remove
};
