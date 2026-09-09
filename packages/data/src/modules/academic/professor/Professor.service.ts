import IO, {
    type ListQueryParams,
    type ProfessorFilter,
    type ProfessorFilterName
} from "#/modules/academic/professor/Professor.contract.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type ProfessorEntity = z.infer<typeof IO.schema>;

const professorWhere = prismaWhereFor<MyPrisma.ProfessorWhereInput>();
const professorWhereDefinitions = {
    classId: professorWhere.numberAt("classes.some.id")
} satisfies Record<
    ProfessorFilterName,
    FilterWhereBuilder<MyPrisma.ProfessorWhereInput>
>;

export function professorFilterWhere(
    filter: ProfessorFilter | undefined
): MyPrisma.ProfessorWhereInput[] {
    return compileFilterWhere(filter, professorWhereDefinitions, "professor");
}

export type ProfessorService = {
    list(
        input: ListQueryParams
    ): Promise<{ items: ProfessorEntity[]; total: number }>;
    getById(
        id: number
    ): Promise<
        Result<
            ProfessorEntity,
            ReturnType<typeof ResourceNotFoundProblem.create>
        >
    >;
};

export function createProfessorService({
    prisma
}: {
    prisma: PrismaClient;
}): ProfessorService {
    return {
        async list(query) {
            const filterWhere = professorFilterWhere(query.filter);
            const where: MyPrisma.ProfessorWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
            const total = await prisma.professor.count({ where });
            const professors = await prisma.professor.findMany({
                where,
                include: { dataPortalProfile: { select: { id: true } } },
                ...(query.page !== undefined || query.pageSize !== undefined
                    ? {
                          skip:
                              ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                          take: query.pageSize ?? 20
                      }
                    : {})
            });
            return {
                total,
                items: professors.map(
                    ({ dataPortalProfile, ...professor }) => ({
                        ...professor,
                        _paths: {
                            entity: `/professors/${professor.id}`,
                            dataPortalProfile: dataPortalProfile
                                ? `/professor-data-portal-profiles/${dataPortalProfile.id}`
                                : null
                        }
                    })
                ) as ProfessorEntity[]
            };
        },
        async getById(id) {
            const professor = await prisma.professor.findUnique({
                where: { id },
                include: { dataPortalProfile: { select: { id: true } } }
            });
            return professor
                ? ok(
                      (({ dataPortalProfile, ...professor }) => ({
                          ...professor,
                          _paths: {
                              entity: `/professors/${professor.id}`,
                              dataPortalProfile: dataPortalProfile
                                  ? `/professor-data-portal-profiles/${dataPortalProfile.id}`
                                  : null
                          }
                      }))(professor) as ProfessorEntity
                  )
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Professor not found"
                      })
                  );
        }
    };
}
