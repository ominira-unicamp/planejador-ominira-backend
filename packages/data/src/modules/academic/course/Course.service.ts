import IO from "#/modules/academic/course/Course.contract.js";
import courseEntity from "#/modules/academic/course/Course.entity.js";
import { courseNotFoundProblem } from "#/modules/academic/course/Course.problems.js";
import { err, ok, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type CourseEntity = z.infer<typeof IO.schema>;
type ListQueryParams = z.infer<typeof IO.list.request>["query"];

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
            const where = {
                ...(query.courseCode
                    ? {
                          code: {
                              contains: query.courseCode,
                              mode: "insensitive" as const
                          }
                      }
                    : {}),
                ...(query.unitId || query.unitCode
                    ? {
                          unit: {
                              ...(query.unitId ? { id: query.unitId } : {}),
                              ...(query.unitCode
                                  ? { code: query.unitCode }
                                  : {})
                          }
                      }
                    : {})
            };
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
                where
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
