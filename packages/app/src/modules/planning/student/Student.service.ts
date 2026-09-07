import type { Principal } from "#/auth.js";
import { raFromDacEmail } from "#/Authorization.js";
import IO from "#/modules/planning/student/Student.contract.js";
import studentEntity from "#/modules/planning/student/Student.entity.js";
import {
    invalidStudentProfileProblem,
    studentIdentityConflictProblem,
    studentNotFoundProblem,
    studentReferenceNotFoundProblem,
    type StudentProblem
} from "#/modules/planning/student/Student.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Student = z.infer<typeof IO.schema>;
type CreateInput = z.infer<typeof IO.create.request>["body"];
type PatchInput = z.infer<typeof IO.patch.request>["body"];
type Fields = Array<{ code: string; path: string[]; message: string }>;

async function validateAcademicSelection(
    prisma: PrismaClient,
    input: Pick<
        Student,
        "catalogId" | "programId" | "specializationId" | "languageId"
    >
): Promise<{ kind: "reference" | "invalid"; fields: Fields } | null> {
    const fields: Fields = [];
    if (
        input.catalogId != null &&
        !(await prisma.catalog.findUnique({
            where: { id: input.catalogId },
            select: { id: true }
        }))
    )
        fields.push({
            code: "REFERENCE_NOT_FOUND",
            path: ["catalogId"],
            message: "O catálogo informado não foi encontrado."
        });
    if (input.programId != null && input.catalogId == null)
        fields.push({
            code: "REQUIRED",
            path: ["catalogId"],
            message: "Um catálogo é necessário ao informar um programa."
        });
    if (
        input.programId != null &&
        input.catalogId != null &&
        !(await prisma.catalogProgram.findUnique({
            where: {
                catalogId_programId: {
                    catalogId: input.catalogId,
                    programId: input.programId
                }
            },
            select: { id: true }
        }))
    )
        fields.push({
            code: "INVALID_VALUE",
            path: ["programId"],
            message: "O programa não está disponível no catálogo informado."
        });
    if (
        input.languageId != null &&
        (input.catalogId == null || input.programId == null)
    )
        fields.push({
            code: "REQUIRED",
            path: ["languageId"],
            message: "Uma língua exige catálogo e programa."
        });
    if (
        input.languageId != null &&
        input.catalogId != null &&
        input.programId != null &&
        !(await prisma.catalogLanguage.findFirst({
            where: {
                languageId: input.languageId,
                catalogProgram: {
                    catalogId: input.catalogId,
                    programId: input.programId
                }
            },
            select: { id: true }
        }))
    )
        fields.push({
            code: "INVALID_VALUE",
            path: ["languageId"],
            message: "A língua não está disponível para o programa informado."
        });
    if (input.specializationId != null && input.programId == null)
        fields.push({
            code: "REQUIRED",
            path: ["specializationId"],
            message: "Uma habilitação exige um programa."
        });
    if (input.specializationId != null && input.programId != null) {
        const specialization = await prisma.specialization.findUnique({
            where: { id: input.specializationId },
            select: { programId: true }
        });
        if (!specialization)
            fields.push({
                code: "REFERENCE_NOT_FOUND",
                path: ["specializationId"],
                message: "A habilitação informada não foi encontrada."
            });
        else if (specialization.programId !== input.programId)
            fields.push({
                code: "INVALID_VALUE",
                path: ["specializationId"],
                message: "A habilitação não pertence ao programa informado."
            });
    }
    if (fields.length === 0) return null;
    return {
        kind: fields.some((field) => field.code === "REFERENCE_NOT_FOUND")
            ? "reference"
            : "invalid",
        fields
    };
}

export type StudentService = {
    list(): Promise<Student[]>;
    getById(
        id: number
    ): Promise<Result<Student, ReturnType<typeof studentNotFoundProblem>>>;
    create(
        principal: Principal | undefined,
        input: CreateInput
    ): Promise<
        Result<
            { student: Student; linked: boolean },
            Exclude<StudentProblem, ReturnType<typeof studentNotFoundProblem>>
        >
    >;
    patch(
        id: number,
        input: PatchInput
    ): Promise<
        Result<
            Student,
            Exclude<
                StudentProblem,
                ReturnType<typeof studentIdentityConflictProblem>
            >
        >
    >;
    remove(
        id: number,
        confirmationRa: string
    ): Promise<
        Result<
            void,
            | ReturnType<typeof studentNotFoundProblem>
            | ReturnType<typeof invalidStudentProfileProblem>
        >
    >;
};

export function createStudentService({
    prisma
}: {
    prisma: PrismaClient;
}): StudentService {
    return {
        async list() {
            return (await prisma.student.findMany()).map(studentEntity.build);
        },
        async getById(id) {
            const student = await prisma.student.findUnique({ where: { id } });
            return student
                ? ok(studentEntity.build(student))
                : err(studentNotFoundProblem());
        },
        async create(principal, input) {
            const ra = raFromDacEmail(principal?.email ?? null);
            if (!principal || !ra)
                return err(
                    studentIdentityConflictProblem(
                        "A identidade autenticada não possui um RA institucional verificável."
                    )
                );
            const existing = await prisma.student.findUnique({ where: { ra } });
            if (principal.studentId !== null)
                return err(
                    studentIdentityConflictProblem(
                        "Esta identidade já está vinculada a um aluno."
                    )
                );
            if (existing) {
                await prisma.authUser.update({
                    where: { id: principal.authUserId },
                    data: { studentId: existing.id }
                });
                return ok({
                    student: studentEntity.build(existing),
                    linked: true
                });
            }
            const validation = await validateAcademicSelection(prisma, {
                catalogId: input.catalogId ?? null,
                programId: input.programId ?? null,
                specializationId: input.specializationId ?? null,
                languageId: input.languageId ?? null
            });
            if (validation?.kind === "reference")
                return err(studentReferenceNotFoundProblem(validation.fields));
            if (validation)
                return err(invalidStudentProfileProblem(validation.fields));
            const student = await prisma.$transaction(async (tx) => {
                const student = await tx.student.create({
                    data: {
                        ra,
                        name: input.name,
                        programId: input.programId,
                        specializationId: input.specializationId,
                        catalogId: input.catalogId,
                        entryYear: input.entryYear,
                        languageId: input.languageId
                    }
                });
                await tx.authUser.update({
                    where: { id: principal.authUserId },
                    data: { studentId: student.id }
                });
                return student;
            });
            return ok({ student: studentEntity.build(student), linked: false });
        },
        async patch(id, input) {
            const existing = await prisma.student.findUnique({ where: { id } });
            if (!existing) return err(studentNotFoundProblem());
            const validation = await validateAcademicSelection(prisma, {
                catalogId:
                    input.catalogId !== undefined
                        ? input.catalogId
                        : existing.catalogId,
                programId:
                    input.programId !== undefined
                        ? input.programId
                        : existing.programId,
                specializationId:
                    input.specializationId !== undefined
                        ? input.specializationId
                        : existing.specializationId,
                languageId:
                    input.languageId !== undefined
                        ? input.languageId
                        : existing.languageId
            });
            if (validation?.kind === "reference")
                return err(studentReferenceNotFoundProblem(validation.fields));
            if (validation)
                return err(invalidStudentProfileProblem(validation.fields));
            return ok(
                studentEntity.build(
                    await prisma.student.update({ where: { id }, data: input })
                )
            );
        },
        async remove(id, confirmationRa) {
            const existing = await prisma.student.findUnique({
                where: { id },
                select: { id: true, ra: true }
            });
            if (!existing) return err(studentNotFoundProblem());
            if (existing.ra !== confirmationRa)
                return err(
                    invalidStudentProfileProblem([
                        {
                            code: "INVALID_VALUE",
                            path: ["confirmationRa"],
                            message:
                                "O RA de confirmação não corresponde ao aluno."
                        }
                    ])
                );
            await prisma.$transaction(async (tx) => {
                await tx.studentCourseAttempt.deleteMany({
                    where: { studentId: id }
                });
                await tx.curriculumCourse.deleteMany({
                    where: { curriculum: { studentId: id } }
                });
                await tx.curriculum.deleteMany({ where: { studentId: id } });
                await tx.periodPlanning.deleteMany({
                    where: { studentId: id }
                });
                await tx.student.delete({ where: { id } });
            });
            return ok(undefined);
        }
    };
}
