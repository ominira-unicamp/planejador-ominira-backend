import IO from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import catalogCourseEntity from "#/modules/catalog/catalog-course/CatalogCourse.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogCourse = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

export type CatalogCourseService = {
    list(query: Query): Promise<{ items: CatalogCourse[]; total: number }>;
    getById(
        id: number
    ): Promise<
        Result<CatalogCourse, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};

export function createCatalogCourseService({
    prisma
}: {
    prisma: PrismaClient;
}): CatalogCourseService {
    return {
        async list(query) {
            const courseWhere = {
                ...(query.courseCode
                    ? {
                          code: {
                              contains: query.courseCode,
                              mode: "insensitive" as const
                          }
                      }
                    : {}),
                ...(query.unitId !== undefined || query.unitCode
                    ? {
                          unit: {
                              ...(query.unitId !== undefined
                                  ? { id: query.unitId }
                                  : {}),
                              ...(query.unitCode
                                  ? { code: query.unitCode }
                                  : {})
                          }
                      }
                    : {})
            };
            const where: MyPrisma.CatalogCourseWhereInput = {
                ...(query.catalogId !== undefined
                    ? { catalogId: query.catalogId }
                    : {}),
                ...(query.catalogYear !== undefined
                    ? { catalog: { year: query.catalogYear } }
                    : {}),
                ...(query.courseId !== undefined
                    ? { courseId: query.courseId }
                    : {}),
                ...(Object.keys(courseWhere).length > 0
                    ? { course: courseWhere }
                    : {}),
                ...(query.coordinatorId !== undefined
                    ? { coordinatorId: query.coordinatorId }
                    : {}),
                ...(query.offeringPeriod !== undefined
                    ? { offeringPeriod: query.offeringPeriod }
                    : {})
            };
            const total = await prisma.catalogCourse.count({ where });
            const courses = await prisma.catalogCourse.findMany({
                ...(query.page !== undefined || query.pageSize !== undefined
                    ? {
                          skip:
                              ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                          take: query.pageSize ?? 20
                      }
                    : {}),
                ...catalogCourseEntity.selection,
                where,
                orderBy: [
                    { catalog: { year: "desc" } },
                    { course: { code: "asc" } }
                ]
            });
            return {
                items: courses.map(catalogCourseEntity.build),
                total
            };
        },
        async getById(id) {
            const course = await prisma.catalogCourse.findUnique({
                ...catalogCourseEntity.selection,
                where: { id }
            });
            return course
                ? ok(catalogCourseEntity.build(course))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Catalog course not found"
                      })
                  );
        }
    };
}
