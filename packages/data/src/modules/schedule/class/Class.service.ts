import IO from "#/modules/schedule/class/Class.contract.js";
import classEntity from "#/modules/schedule/class/Class.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import { whereIdCode, whereIdName, type PrismaClient } from "@pomi/db";
import z from "zod";
type ClassEntity = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
export type ClassService = {
    list(query: Query): Promise<{ items: ClassEntity[]; total: number }>;
    getById(
        id: number
    ): Promise<
        Result<ClassEntity, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createClassService({
    prisma
}: {
    prisma: PrismaClient;
}): ClassService {
    return {
        async list(query) {
            const where = {
                ...(query.classCode
                    ? {
                          code: {
                              contains: query.classCode,
                              mode: "insensitive" as const
                          }
                      }
                    : {}),
                course: {
                    ...whereIdCode(query.courseId, query.courseCode),
                    unit: whereIdCode(query.unitId, query.unitCode)
                },
                studyPeriod: whereIdCode(
                    query.studyPeriodId,
                    query.studyPeriodCode
                ),
                ...(query.professorId || query.professorName
                    ? {
                          professors: {
                              some: whereIdName(
                                  query.professorId,
                                  query.professorName
                              )
                          }
                      }
                    : {})
            };
            const [total, items] = await Promise.all([
                prisma.class.count({ where }),
                prisma.class.findMany({
                    ...classEntity.prismaSelection,
                    where,
                    skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                    take: query.pageSize ?? 20
                })
            ]);
            return { total, items: items.map(classEntity.build) };
        },
        async getById(id) {
            const value = await prisma.class.findUnique({
                ...classEntity.prismaSelection,
                where: { id }
            });
            return value
                ? ok(classEntity.build(value))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Class not found"
                      })
                  );
        }
    };
}
