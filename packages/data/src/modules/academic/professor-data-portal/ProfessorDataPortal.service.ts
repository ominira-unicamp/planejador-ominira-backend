import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { Department, Prisma, PrismaClient } from "@pomi/db";

type Profile = ReturnType<typeof buildProfile>;
const profileInclude = {
    unit: true,
    department: true,
    position: { include: { careerReference: true } },
    identities: true,
    citationNames: true,
    trainings: true,
    keywords: { include: { keyword: true } },
    coauthors: { include: { coauthor: true } }
} as const;

type ProfileValue = Prisma.ProfessorDataPortalProfileGetPayload<{
    include: typeof profileInclude;
}>;
type PositionValue = Prisma.AcademicPositionGetPayload<{
    include: { careerReference: true };
}>;
type ProfileQuery = {
    page?: number;
    pageSize?: number;
    professorId?: number;
    portalId?: number;
    unitId?: number;
    departmentId?: number;
    positionId?: number;
    name?: string;
};
type NameQuery = { page?: number; pageSize?: number; name?: string };

function buildPosition(value: PositionValue) {
    return {
        id: value.id,
        canonicalKey: value.canonicalKey,
        role: value.role,
        affiliationType: value.affiliationType,
        programCode: value.programCode,
        postdoctoralModality: value.postdoctoralModality,
        careerReference: value.careerReference
            ? {
                  career: value.careerReference.career,
                  code: value.careerReference.code,
                  rank: value.careerReference.rank,
                  category: value.careerReference.category,
                  progressionOrder: value.careerReference.progressionOrder
              }
            : null
    };
}

function buildProfile(value: ProfileValue) {
    return {
        id: value.id,
        professorId: value.professorId,
        portalId: value.portalId,
        name: value.name,
        email: value.email,
        lattesAbstract: value.lattesAbstract,
        unit: {
            id: value.unit.id,
            code: value.unit.code,
            name: value.unit.name
        },
        department: value.department
            ? {
                  id: value.department.id,
                  name: value.department.name,
                  unitId: value.department.unitId
              }
            : null,
        position: value.position ? buildPosition(value.position) : null,
        identifiers: value.identities.map((item) => ({
            id: item.id,
            system: item.system,
            externalId: item.externalId
        })),
        citationNames: value.citationNames.map((item) => ({
            id: item.id,
            name: item.name
        })),
        trainings: value.trainings.map((item) => ({
            id: item.id,
            degree: item.degree,
            institutionName: item.institutionName,
            startYear: item.startYear,
            endYear: item.endYear
        })),
        keywords: value.keywords.map((item) => ({
            id: item.keyword.id,
            name: item.keyword.name,
            count: item.count
        })),
        coauthors: value.coauthors.map((item) => ({
            id: item.coauthor.id,
            name: item.coauthor.name,
            count: item.count
        })),
        _paths: {
            self: `/professor-data-portal-profiles/${value.id}`,
            professor: `/professors/${value.professorId}`
        }
    };
}

export type ProfessorDataPortalService = {
    listProfiles(
        query: ProfileQuery
    ): Promise<{ items: Profile[]; total: number }>;
    getProfile(
        id: number
    ): Promise<
        Result<Profile, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
    listPositions(): Promise<ReturnType<typeof buildPosition>[]>;
    getPosition(
        id: number
    ): Promise<
        Result<
            ReturnType<typeof buildPosition>,
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
    listDepartments(
        query: NameQuery & { unitId?: number }
    ): Promise<Department[]>;
    getDepartment(
        id: number
    ): Promise<
        Result<Department, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
    listKeywords(
        query: NameQuery
    ): Promise<{ items: Array<{ id: number; name: string }>; total: number }>;
    getKeyword(
        id: number
    ): Promise<
        Result<
            { id: number; name: string },
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
    listCoauthors(
        query: NameQuery
    ): Promise<{ items: Array<{ id: number; name: string }>; total: number }>;
    getCoauthor(
        id: number
    ): Promise<
        Result<
            { id: number; name: string },
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
};

const notFound = () =>
    err(ResourceNotFoundProblem.create({ detail: "Resource not found" }));
export function createProfessorDataPortalService({
    prisma
}: {
    prisma: PrismaClient;
}): ProfessorDataPortalService {
    return {
        async listProfiles(query) {
            const where = {
                ...(query.professorId
                    ? { professorId: query.professorId }
                    : {}),
                ...(query.portalId ? { portalId: query.portalId } : {}),
                ...(query.unitId ? { unitId: query.unitId } : {}),
                ...(query.departmentId
                    ? { departmentId: query.departmentId }
                    : {}),
                ...(query.positionId ? { positionId: query.positionId } : {}),
                ...(query.name
                    ? {
                          name: {
                              contains: query.name,
                              mode: "insensitive" as const
                          }
                      }
                    : {})
            };
            const [total, values] = await Promise.all([
                prisma.professorDataPortalProfile.count({ where }),
                prisma.professorDataPortalProfile.findMany({
                    where,
                    include: profileInclude,
                    orderBy: [{ name: "asc" }, { id: "asc" }],
                    skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                    take: query.pageSize ?? 20
                })
            ]);
            return { total, items: values.map((value) => buildProfile(value)) };
        },
        async getProfile(id) {
            const value = await prisma.professorDataPortalProfile.findUnique({
                where: { id },
                include: profileInclude
            });
            return value ? ok(buildProfile(value)) : notFound();
        },
        async listPositions() {
            const values = await prisma.academicPosition.findMany({
                include: { careerReference: true },
                orderBy: { canonicalKey: "asc" }
            });
            return values.map(buildPosition);
        },
        async getPosition(id) {
            const value = await prisma.academicPosition.findUnique({
                where: { id },
                include: { careerReference: true }
            });
            return value ? ok(buildPosition(value)) : notFound();
        },
        async listDepartments(query) {
            return prisma.department.findMany({
                where: {
                    ...(query.unitId ? { unitId: query.unitId } : {}),
                    ...(query.name
                        ? {
                              name: {
                                  contains: query.name,
                                  mode: "insensitive"
                              }
                          }
                        : {})
                },
                orderBy: [{ name: "asc" }, { id: "asc" }]
            });
        },
        async getDepartment(id) {
            const value = await prisma.department.findUnique({ where: { id } });
            return value ? ok(value) : notFound();
        },
        async listKeywords(query) {
            const where = query.name
                ? {
                      name: {
                          contains: query.name,
                          mode: "insensitive" as const
                      }
                  }
                : {};
            const [total, values] = await Promise.all([
                prisma.keyword.count({ where }),
                prisma.keyword.findMany({
                    where,
                    orderBy: [{ name: "asc" }, { id: "asc" }],
                    skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                    take: query.pageSize ?? 20
                })
            ]);
            return {
                total,
                items: values.map(({ id, name }) => ({ id, name }))
            };
        },
        async getKeyword(id) {
            const value = await prisma.keyword.findUnique({ where: { id } });
            return value ? ok({ id: value.id, name: value.name }) : notFound();
        },
        async listCoauthors(query) {
            const where = query.name
                ? {
                      name: {
                          contains: query.name,
                          mode: "insensitive" as const
                      }
                  }
                : {};
            const [total, values] = await Promise.all([
                prisma.coauthor.count({ where }),
                prisma.coauthor.findMany({
                    where,
                    orderBy: [{ name: "asc" }, { id: "asc" }],
                    skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                    take: query.pageSize ?? 20
                })
            ]);
            return {
                total,
                items: values.map(({ id, name }) => ({ id, name }))
            };
        },
        async getCoauthor(id) {
            const value = await prisma.coauthor.findUnique({ where: { id } });
            return value ? ok({ id: value.id, name: value.name }) : notFound();
        }
    };
}
