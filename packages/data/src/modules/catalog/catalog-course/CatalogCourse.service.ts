import type { CatalogCourseFilter } from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import IO from "#/modules/catalog/catalog-course/CatalogCourse.contract.js";
import catalogCourseEntity from "#/modules/catalog/catalog-course/CatalogCourse.entity.js";
import {
    err,
    ok,
    ResourceNotFoundProblem,
    type QueryFilterOperator,
    type Result
} from "@pomi/api-core";
import type { CourseOfferingPeriod, MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CatalogCourse = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

function scalarFilter<T extends string | number>(
    operator: QueryFilterOperator,
    values: T[]
): { equals?: T; not?: T; in?: T[] } {
    switch (operator) {
        case "eq":
            return { equals: values[0] };
        case "ne":
            return { not: values[0] };
        case "in":
            return { in: values };
        default:
            throw new Error(`Unsupported catalog course filter: ${operator}`);
    }
}

function offeringPeriodFilter(
    operator: QueryFilterOperator,
    values: CourseOfferingPeriod[]
): MyPrisma.EnumCourseOfferingPeriodNullableFilter {
    return scalarFilter(operator, values);
}

export function catalogCourseFilterWhere(
    filter: CatalogCourseFilter | undefined
): MyPrisma.CatalogCourseWhereInput[] {
    return (filter ?? []).map((expression) => {
        const values = expression.values;
        switch (expression.path.join(".")) {
            case "catalogId":
                return {
                    catalogId: scalarFilter(
                        expression.operator,
                        values as number[]
                    )
                };
            case "catalogYear":
                return {
                    catalog: {
                        year: scalarFilter(
                            expression.operator,
                            values as number[]
                        )
                    }
                };
            case "courseId":
                return {
                    courseId: scalarFilter(
                        expression.operator,
                        values as number[]
                    )
                };
            case "courseCode":
                return {
                    course: {
                        code: scalarFilter(
                            expression.operator,
                            values as string[]
                        )
                    }
                };
            case "unit.id":
                return {
                    course: {
                        unit: {
                            id: scalarFilter(
                                expression.operator,
                                values as number[]
                            )
                        }
                    }
                };
            case "unit.code":
                return {
                    course: {
                        unit: {
                            code: scalarFilter(
                                expression.operator,
                                values as string[]
                            )
                        }
                    }
                };
            case "coordinatorId":
                return {
                    coordinatorId: scalarFilter(
                        expression.operator,
                        values as number[]
                    )
                };
            case "offeringPeriod":
                return {
                    offeringPeriod: offeringPeriodFilter(
                        expression.operator,
                        values as CourseOfferingPeriod[]
                    )
                };
            default:
                throw new Error(
                    `Unsupported catalog course filter: ${expression.path.join(".")}`
                );
        }
    });
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
