import periodPlanningEntity, {
    prismaPeriodPlanningFieldSelection
} from "#/modules/planning/period-plan/PeriodPlan.entity.js";
import IO from "#/modules/planning/shared-period-plan/SharedPeriodPlan.contract.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type SharedPeriodPlan = z.infer<typeof IO.schema>;
type PublicQuery = z.infer<typeof IO.listPublic.request>["query"];
type StudentQuery = z.infer<typeof IO.listForStudent.request>["query"];
type NotFound = ReturnType<typeof ResourceNotFoundProblem.create>;

const selection = {
    ...prismaPeriodPlanningFieldSelection,
    include: {
        ...prismaPeriodPlanningFieldSelection.include,
        student: {
            select: {
                id: true,
                publicId: true,
                publicProfileEnabled: true,
                publicDisplayName: true
            }
        }
    }
} as const;

type Selected = MyPrisma.PeriodPlanningGetPayload<typeof selection>;

function notFound(): NotFound {
    return ResourceNotFoundProblem.create({
        detail: "O planejamento compartilhado solicitado não foi encontrado."
    });
}

function buildShared(row: NonNullable<Selected>): SharedPeriodPlan {
    if (row.visibility === "PRIVATE")
        throw new Error("A private period plan cannot be shared.");
    const entity = periodPlanningEntity.build(row);
    return {
        shareId: row.shareId,
        name: row.name,
        visibility: row.visibility,
        studyPeriodId: entity.studyPeriodId,
        studyPeriodYear: entity.studyPeriodYear,
        studyPeriodYearPeriod: entity.studyPeriodYearPeriod,
        owner: row.student.publicProfileEnabled
            ? {
                  publicId: row.student.publicId,
                  displayName: row.student.publicDisplayName ?? "Aluno do POMI"
              }
            : null,
        classes: entity.classes,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    };
}

function publicWhere(query: PublicQuery) {
    return {
        visibility: "PUBLIC" as const,
        ...(query.studyPeriodId === undefined
            ? {}
            : { studyPeriodId: query.studyPeriodId }),
        ...(query.query
            ? {
                  OR: [
                      {
                          name: {
                              contains: query.query,
                              mode: "insensitive" as const
                          }
                      },
                      {
                          student: {
                              publicProfileEnabled: true,
                              publicDisplayName: {
                                  contains: query.query,
                                  mode: "insensitive" as const
                              }
                          }
                      }
                  ]
              }
            : {})
    };
}

export type SharedPeriodPlanService = {
    listPublic(input: PublicQuery): Promise<{
        items: SharedPeriodPlan[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getPublic(shareId: string): Promise<Result<SharedPeriodPlan, NotFound>>;
    listForStudent(
        studentId: number,
        input: StudentQuery
    ): Promise<{
        items: SharedPeriodPlan[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getForStudent(
        studentId: number,
        shareId: string
    ): Promise<Result<SharedPeriodPlan, NotFound>>;
};

export function createSharedPeriodPlanService({
    prisma
}: {
    prisma: PrismaClient;
}): SharedPeriodPlanService {
    const findFriend = (viewerId: number) => ({
        OR: [
            { studentAId: viewerId, status: "ACCEPTED" as const },
            { studentBId: viewerId, status: "ACCEPTED" as const }
        ]
    });
    const sharedWhere = (studentId: number, ownerPublicId?: string) => {
        const visibility = {
            OR: [
                { visibility: "PUBLIC" as const },
                {
                    visibility: "FRIENDS" as const,
                    student: { friendshipsAsA: { some: findFriend(studentId) } }
                },
                {
                    visibility: "FRIENDS" as const,
                    student: { friendshipsAsB: { some: findFriend(studentId) } }
                }
            ]
        };
        return ownerPublicId
            ? { AND: [{ student: { publicId: ownerPublicId } }, visibility] }
            : visibility;
    };
    return {
        async listPublic(input) {
            const where = publicWhere(input);
            const [rows, total] = await Promise.all([
                prisma.periodPlanning.findMany({
                    ...selection,
                    where,
                    orderBy: { updatedAt: "desc" },
                    skip: (input.page - 1) * input.pageSize,
                    take: input.pageSize
                }),
                prisma.periodPlanning.count({ where })
            ]);
            return {
                items: rows.map(buildShared),
                page: input.page,
                pageSize: input.pageSize,
                total
            };
        },
        async getPublic(shareId) {
            const row = await prisma.periodPlanning.findFirst({
                ...selection,
                where: { shareId, visibility: "PUBLIC" }
            });
            return row ? ok(buildShared(row)) : err(notFound());
        },
        async listForStudent(studentId, input) {
            const where = sharedWhere(studentId, input.ownerPublicId);
            const [rows, total] = await Promise.all([
                prisma.periodPlanning.findMany({
                    ...selection,
                    where,
                    orderBy: { updatedAt: "desc" },
                    skip: (input.page - 1) * input.pageSize,
                    take: input.pageSize
                }),
                prisma.periodPlanning.count({ where })
            ]);
            return {
                items: rows.map(buildShared),
                page: input.page,
                pageSize: input.pageSize,
                total
            };
        },
        async getForStudent(studentId, shareId) {
            const row = await prisma.periodPlanning.findFirst({
                ...selection,
                where: { shareId, ...sharedWhere(studentId) }
            });
            return row ? ok(buildShared(row)) : err(notFound());
        }
    };
}
