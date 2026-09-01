import IO from "#/modules/social/student-social/StudentSocial.contract.js";
import {
    socialConflictProblem,
    socialNotFoundProblem
} from "#/modules/social/student-social/StudentSocial.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type Person = z.infer<typeof IO.schemas.person>;
type Profile = z.infer<typeof IO.schemas.ownProfile>;
type Friendship = z.infer<typeof IO.schemas.friendship>;
type ProfileBody = z.infer<typeof IO.updateProfile.request>["body"];
type PeopleQuery = z.infer<typeof IO.listPeople.request>["query"];
type FriendshipQuery = z.infer<typeof IO.listFriendships.request>["query"];

const personSelection = {
    id: true,
    publicId: true,
    name: true,
    publicProfileEnabled: true,
    publicDisplayName: true,
    publicBio: true,
    showProgram: true,
    showSpecialization: true,
    showEntryYear: true,
    entryYear: true,
    program: { select: { code: true, name: true } },
    specialization: { select: { code: true, name: true } }
} as const;

type SelectedPerson = {
    id: number;
    publicId: string;
    name: string;
    publicProfileEnabled: boolean;
    publicDisplayName: string | null;
    publicBio: string | null;
    showProgram: boolean;
    showSpecialization: boolean;
    showEntryYear: boolean;
    entryYear: number | null;
    program: { code: number; name: string } | null;
    specialization: { code: string; name: string } | null;
};

function buildPerson(
    student: SelectedPerson,
    viewerStudentId: number,
    forceMinimal = false
): Person {
    const disclose = student.publicProfileEnabled && !forceMinimal;
    return {
        publicId: student.publicId,
        displayName: student.publicDisplayName ?? student.name,
        bio: disclose ? student.publicBio : null,
        program: disclose && student.showProgram ? student.program : null,
        specialization:
            disclose && student.showSpecialization
                ? student.specialization
                : null,
        entryYear: disclose && student.showEntryYear ? student.entryYear : null,
        _paths: {
            self: `/student/${viewerStudentId}/people/${student.publicId}`
        }
    };
}

function buildProfile(student: SelectedPerson): Profile {
    return {
        publicId: student.publicId,
        displayName: student.publicDisplayName ?? student.name,
        bio: student.publicBio,
        program: student.program,
        specialization: student.specialization,
        entryYear: student.entryYear,
        _paths: { self: `/student/${student.id}/public-profile` },
        enabled: student.publicProfileEnabled,
        showProgram: student.showProgram,
        showSpecialization: student.showSpecialization,
        showEntryYear: student.showEntryYear
    };
}

type SelectedFriendship = {
    id: number;
    studentAId: number;
    studentBId: number;
    requestedById: number;
    status: "PENDING" | "ACCEPTED";
    acceptedAt: Date | null;
    createdAt: Date;
    studentA: SelectedPerson;
    studentB: SelectedPerson;
};

function buildFriendship(
    row: SelectedFriendship,
    studentId: number
): Friendship {
    const friend = row.studentAId === studentId ? row.studentB : row.studentA;
    return {
        id: row.id,
        status: row.status,
        direction:
            row.status === "ACCEPTED"
                ? "NONE"
                : row.requestedById === studentId
                  ? "OUTGOING"
                  : "INCOMING",
        friend: buildPerson(friend, studentId, !friend.publicProfileEnabled),
        createdAt: row.createdAt.toISOString(),
        acceptedAt: row.acceptedAt?.toISOString() ?? null,
        _paths: {
            self: `/student/${studentId}/friendships/${row.id}`,
            friend: `/student/${studentId}/people/${friend.publicId}`
        }
    };
}

const friendshipSelection = {
    include: {
        studentA: { select: personSelection },
        studentB: { select: personSelection }
    }
} as const;

function isUniqueViolation(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    );
}

type NotFoundProblem = ReturnType<typeof socialNotFoundProblem>;
type ConflictProblem = ReturnType<typeof socialConflictProblem>;
export type StudentSocialService = {
    getProfile(studentId: number): Promise<Result<Profile, NotFoundProblem>>;
    updateProfile(
        studentId: number,
        input: ProfileBody
    ): Promise<Result<Profile, NotFoundProblem>>;
    listPeople(
        studentId: number,
        input: PeopleQuery
    ): Promise<{
        items: Person[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getPerson(
        studentId: number,
        publicId: string
    ): Promise<Result<Person, NotFoundProblem>>;
    listFriendships(
        studentId: number,
        input: FriendshipQuery
    ): Promise<Friendship[]>;
    createFriendship(
        studentId: number,
        targetPublicId: string
    ): Promise<Result<Friendship, NotFoundProblem | ConflictProblem>>;
    acceptFriendship(
        studentId: number,
        id: number
    ): Promise<Result<Friendship, NotFoundProblem | ConflictProblem>>;
    removeFriendship(
        studentId: number,
        id: number
    ): Promise<Result<void, NotFoundProblem>>;
};

export function createStudentSocialService({
    prisma
}: {
    prisma: PrismaClient;
}): StudentSocialService {
    const findFriendship = (id: number) =>
        prisma.studentFriendship.findUnique({
            where: { id },
            ...friendshipSelection
        });
    return {
        async getProfile(studentId) {
            const student = await prisma.student.findUnique({
                where: { id: studentId },
                select: personSelection
            });
            return student
                ? ok(buildProfile(student))
                : err(
                      socialNotFoundProblem(
                          "O aluno solicitado não foi encontrado."
                      )
                  );
        },
        async updateProfile(studentId, input) {
            const existing = await prisma.student.findUnique({
                where: { id: studentId },
                select: { id: true }
            });
            if (!existing)
                return err(
                    socialNotFoundProblem(
                        "O aluno solicitado não foi encontrado."
                    )
                );
            const student = await prisma.student.update({
                where: { id: studentId },
                data: {
                    publicProfileEnabled: input.enabled,
                    publicDisplayName: input.displayName,
                    publicBio: input.bio,
                    showProgram: input.showProgram,
                    showSpecialization: input.showSpecialization,
                    showEntryYear: input.showEntryYear
                },
                select: personSelection
            });
            return ok(buildProfile(student));
        },
        async listPeople(studentId, input) {
            const visibleName = {
                OR: [
                    {
                        publicDisplayName: {
                            contains: input.query,
                            mode: "insensitive" as const
                        }
                    },
                    {
                        publicDisplayName: null,
                        name: {
                            contains: input.query,
                            mode: "insensitive" as const
                        }
                    }
                ]
            };
            const where = {
                id: { not: studentId },
                publicProfileEnabled: true,
                authUsers: { some: { status: "ACTIVE" as const } },
                ...(z.string().uuid().safeParse(input.query).success
                    ? { OR: [{ publicId: input.query }, visibleName] }
                    : visibleName)
            };
            const [students, total] = await Promise.all([
                prisma.student.findMany({
                    where,
                    select: personSelection,
                    orderBy: [{ publicDisplayName: "asc" }, { name: "asc" }],
                    skip: (input.page - 1) * input.pageSize,
                    take: input.pageSize
                }),
                prisma.student.count({ where })
            ]);
            return {
                items: students.map((student) =>
                    buildPerson(student, studentId)
                ),
                page: input.page,
                pageSize: input.pageSize,
                total
            };
        },
        async getPerson(studentId, publicId) {
            const student = await prisma.student.findFirst({
                where: {
                    publicId,
                    id: { not: studentId },
                    publicProfileEnabled: true,
                    authUsers: { some: { status: "ACTIVE" } }
                },
                select: personSelection
            });
            return student
                ? ok(buildPerson(student, studentId))
                : err(
                      socialNotFoundProblem(
                          "O perfil público solicitado não foi encontrado."
                      )
                  );
        },
        async listFriendships(studentId, input) {
            const rows = await prisma.studentFriendship.findMany({
                where: {
                    OR: [{ studentAId: studentId }, { studentBId: studentId }],
                    status: input.status,
                    ...(input.direction === "INCOMING"
                        ? {
                              requestedById: { not: studentId },
                              status: "PENDING" as const
                          }
                        : {}),
                    ...(input.direction === "OUTGOING"
                        ? {
                              requestedById: studentId,
                              status: "PENDING" as const
                          }
                        : {})
                },
                ...friendshipSelection,
                orderBy: { updatedAt: "desc" }
            });
            return rows.map((row) => buildFriendship(row, studentId));
        },
        async createFriendship(studentId, targetPublicId) {
            const target = await prisma.student.findFirst({
                where: {
                    publicId: targetPublicId,
                    publicProfileEnabled: true,
                    authUsers: { some: { status: "ACTIVE" } }
                },
                select: { id: true }
            });
            if (!target)
                return err(
                    socialNotFoundProblem(
                        "O perfil público solicitado não foi encontrado."
                    )
                );
            if (target.id === studentId)
                return err(
                    socialConflictProblem(
                        "Não é possível enviar uma solicitação de amizade para si mesmo."
                    )
                );
            const studentAId = Math.min(studentId, target.id);
            const studentBId = Math.max(studentId, target.id);
            try {
                const row = await prisma.studentFriendship.create({
                    data: { studentAId, studentBId, requestedById: studentId },
                    ...friendshipSelection
                });
                return ok(buildFriendship(row, studentId));
            } catch (error) {
                if (isUniqueViolation(error))
                    return err(
                        socialConflictProblem(
                            "Já existe uma amizade ou solicitação entre estes alunos."
                        )
                    );
                throw error;
            }
        },
        async acceptFriendship(studentId, id) {
            const existing = await prisma.studentFriendship.findFirst({
                where: {
                    id,
                    OR: [{ studentAId: studentId }, { studentBId: studentId }]
                },
                select: { status: true, requestedById: true }
            });
            if (!existing)
                return err(
                    socialNotFoundProblem("A solicitação não foi encontrada.")
                );
            if (
                existing.status !== "PENDING" ||
                existing.requestedById === studentId
            )
                return err(
                    socialConflictProblem(
                        "A solicitação não pode ser aceita por este aluno."
                    )
                );
            const updated = await prisma.studentFriendship.updateMany({
                where: {
                    id,
                    status: "PENDING",
                    requestedById: { not: studentId },
                    OR: [{ studentAId: studentId }, { studentBId: studentId }]
                },
                data: { status: "ACCEPTED", acceptedAt: new Date() }
            });
            if (!updated.count)
                return err(
                    socialConflictProblem(
                        "A solicitação já foi alterada e não pode mais ser aceita."
                    )
                );
            const row = await findFriendship(id);
            return row
                ? ok(buildFriendship(row, studentId))
                : err(
                      socialNotFoundProblem("A solicitação não foi encontrada.")
                  );
        },
        async removeFriendship(studentId, id) {
            const removed = await prisma.studentFriendship.deleteMany({
                where: {
                    id,
                    OR: [{ studentAId: studentId }, { studentBId: studentId }]
                }
            });
            return removed.count
                ? ok(undefined)
                : err(
                      socialNotFoundProblem(
                          "A amizade ou solicitação não foi encontrada."
                      )
                  );
        }
    };
}
