import type {
    CatalogCourseFilter,
    CatalogCourseFilterName
} from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import IO from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import catalogCourseEntity from "#/modules/catalog/catalog-course/CatalogCourse.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogCourse = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

const catalogCourseWhere = prismaWhereFor<MyPrisma.CatalogCourseWhereInput>();
const catalogCourseWhereDefinitions = {
    "catalogId": catalogCourseWhere.numberAt("catalogId"),
    "catalogYear": catalogCourseWhere.numberAt("catalog.year"),
    "courseId": catalogCourseWhere.numberAt("courseId"),
    "courseCode": catalogCourseWhere.stringAt("course.code"),
    "unit.id": catalogCourseWhere.numberAt("course.unit.id"),
    "unit.code": catalogCourseWhere.stringAt("course.unit.code"),
    "coordinatorId": catalogCourseWhere.numberAt("coordinatorId"),
    "offeringPeriod": catalogCourseWhere.enumAt("offeringPeriod")
} satisfies Record<
    CatalogCourseFilterName,
    FilterWhereBuilder<MyPrisma.CatalogCourseWhereInput>
>;

export function catalogCourseFilterWhere(
    filter: CatalogCourseFilter | undefined
): MyPrisma.CatalogCourseWhereInput[] {
    return compileFilterWhere<MyPrisma.CatalogCourseWhereInput>(
        filter,
        catalogCourseWhereDefinitions,
        "catalog course"
    );
}

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
            const filterWhere = catalogCourseFilterWhere(query.filter);
            const where: MyPrisma.CatalogCourseWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
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
