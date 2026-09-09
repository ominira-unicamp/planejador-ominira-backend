import type {
    CourseFilter,
    CourseFilterValue
} from "#/modules/academic/course/Course.contract.js";
import IO from "#/modules/academic/course/Course.contract.js";
import courseEntity from "#/modules/academic/course/Course.entity.js";
import { courseNotFoundProblem } from "#/modules/academic/course/Course.problems.js";
import { err, ok, type QueryFilterOperator, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type CourseEntity = z.infer<typeof IO.schema>;
type ListQueryParams = z.infer<typeof IO.list.request>["query"];

function stringFilter(
    operator: QueryFilterOperator,
    values: CourseFilterValue[]
): MyPrisma.StringFilter {
    const strings = values.map(String);
    switch (operator) {
        case "eq":
            return { equals: strings[0] };
        case "ne":
            return { not: strings[0] };
        case "in":
            return { in: strings };
        case "gt":
            return { gt: strings[0] };
        case "gte":
            return { gte: strings[0] };
        case "lt":
            return { lt: strings[0] };
        case "lte":
            return { lte: strings[0] };
    }
}

function intFilter(
    operator: QueryFilterOperator,
    values: CourseFilterValue[]
): MyPrisma.IntFilter {
    const integers = values.map(Number);
    switch (operator) {
        case "eq":
            return { equals: integers[0] };
        case "ne":
            return { not: integers[0] };
        case "in":
            return { in: integers };
        case "gt":
            return { gt: integers[0] };
        case "gte":
            return { gte: integers[0] };
        case "lt":
            return { lt: integers[0] };
        case "lte":
            return { lte: integers[0] };
    }
}

export function courseFilterWhere(
    filter: CourseFilter | undefined
): MyPrisma.CourseWhereInput[] {
    return (filter ?? []).map((expression) => {
        switch (expression.path.join(".")) {
            case "catalogYear":
                return {
                    catalogCourses: {
                        some: {
                            catalog: {
                                year: intFilter(
                                    expression.operator,
                                    expression.values
                                )
                            }
                        }
                    }
                };
            case "code":
                return {
                    code: stringFilter(expression.operator, expression.values)
                };
            case "credits":
                return {
                    credits: intFilter(expression.operator, expression.values)
                };
            case "tagId":
                return {
                    courseTags: {
                        some: {
                            tagId: intFilter(
                                expression.operator,
                                expression.values
                            )
                        }
                    }
                };
            case "unit.code":
                return {
                    unit: {
                        code: stringFilter(
                            expression.operator,
                            expression.values
                        )
                    }
                };
            case "unit.id":
                return {
                    unit: {
                        id: intFilter(expression.operator, expression.values)
                    }
                };
            default:
                throw new Error(
                    `Unsupported course filter: ${expression.path.join(".")}`
                );
        }
    });
}

export type CourseService = {
    list(input: ListQueryParams): Promise<{
        items: CourseEntity[];
        total: number;
    }>;
    getById(
        id: number
    ): Promise<Result<CourseEntity, ReturnType<typeof courseNotFoundProblem>>>;
};

export function createCourseService({
    prisma
}: {
    prisma: PrismaClient;
}): CourseService {
    return {
        async list(query) {
            const filterWhere = courseFilterWhere(query.filter);
            const where: MyPrisma.CourseWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
            const total = await prisma.course.count({ where });
            const courses = await prisma.course.findMany({
                ...(query.page !== undefined || query.pageSize !== undefined
                    ? {
                          skip:
                              ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
                          take: query.pageSize ?? 20
                      }
                    : {}),
                ...courseEntity.selection,
                where,
                orderBy: { code: "asc" }
            });
            return { items: courses.map(courseEntity.build), total };
        },
        async getById(id) {
            const course = await prisma.course.findUnique({
                ...courseEntity.selection,
                where: { id }
            });
            return course
                ? ok(courseEntity.build(course))
                : err(courseNotFoundProblem());
        }
    };
}
