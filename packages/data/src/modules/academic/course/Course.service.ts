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
            const text = query.q?.trim();
            const where = {
                ...(query.courseCode
                    ? {
                          code: {
                              contains: query.courseCode,
                              mode: "insensitive" as const
                          }
                      }
                    : {}),
                ...(text
                    ? {
                          OR: [
                              {
                                  code: {
                                      contains: text,
                                      mode: "insensitive" as const
                                  }
                              },
                              {
                                  name: {
                                      contains: text,
                                      mode: "insensitive" as const
                                  }
                              }
                          ]
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
                    : {}),
                ...(query.catalogYear
                    ? {
                          catalogCourses: {
                              some: { catalog: { year: query.catalogYear } }
                          }
                      }
                    : {}),
                ...(query.tagId
                    ? { courseTags: { some: { tagId: query.tagId } } }
                    : {})
            };
            const total = await prisma.course.count({ where });
            const courses = await prisma.course.findMany({
                ...(!text &&
                (query.page !== undefined || query.pageSize !== undefined)
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
            if (!text) return { items: courses.map(courseEntity.build), total };

            const normalizedText = text.toLocaleLowerCase("pt-BR");
            const ranked = courses.sort((left, right) => {
                const leftCode = left.code.toLocaleLowerCase("pt-BR");
                const rightCode = right.code.toLocaleLowerCase("pt-BR");
                const leftName = left.name.toLocaleLowerCase("pt-BR");
                const rightName = right.name.toLocaleLowerCase("pt-BR");
                const rank = (code: string, name: string) => {
                    if (code === normalizedText) return 0;
                    if (code.startsWith(normalizedText)) return 1;
                    if (name.startsWith(normalizedText)) return 2;
                    return 3;
                };
                return (
                    rank(leftCode, leftName) - rank(rightCode, rightName) ||
                    left.code.localeCompare(right.code, "pt-BR")
                );
            });
            const page = query.page ?? 1;
            const pageSize = query.pageSize ?? Math.max(total, 1);
            const start = (page - 1) * pageSize;
            return {
                items: ranked
                    .slice(start, start + pageSize)
                    .map(courseEntity.build),
                total
            };
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
