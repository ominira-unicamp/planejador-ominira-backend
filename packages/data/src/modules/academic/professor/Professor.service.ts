import IO, {
    type ListQueryParams
} from "#/modules/academic/professor/Professor.contract.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type ProfessorEntity = z.infer<typeof IO.schema>;

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
            const where = query.classId
                ? { classes: { some: { id: query.classId } } }
                : {};
            const total = await prisma.professor.count({ where });
            const professors = await prisma.professor.findMany({
                where,
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
                items: professors.map((professor) => ({
                    ...professor,
                    _paths: { entity: `/professors/${professor.id}` }
                })) as ProfessorEntity[]
            };
        },
        async getById(id) {
            const professor = await prisma.professor.findUnique({
                where: { id }
            });
            return professor
                ? ok({
                      ...professor,
                      _paths: { entity: `/professors/${professor.id}` }
                  } as ProfessorEntity)
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Professor not found"
                      })
                  );
        }
    };
}
