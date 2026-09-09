import type {
    ClassFilter,
    ClassFilterName
} from "#/modules/schedule/class/Class.contract.js";
import IO from "#/modules/schedule/class/Class.contract.js";
import classEntity from "#/modules/schedule/class/Class.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type ClassEntity = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

const classWhere = prismaWhereFor<MyPrisma.ClassWhereInput>();
const classWhereDefinitions = {
    classCode: classWhere.containsAt("code"),
    unitId: classWhere.numberAt("course.unit.id"),
    unitCode: classWhere.containsAt("course.unit.code"),
    courseId: classWhere.numberAt("course.id"),
    courseCode: classWhere.containsAt("course.code"),
    studyPeriodId: classWhere.numberAt("studyPeriod.id"),
    studyPeriodYear: classWhere.numberAt("studyPeriod.year"),
    studyPeriodYearPeriod: classWhere.enumAt("studyPeriod.yearPeriod"),
    professorId: classWhere.numberAt("professors.some.id"),
    professorName: classWhere.containsAt("professors.some.name")
} satisfies Record<
    ClassFilterName,
    FilterWhereBuilder<MyPrisma.ClassWhereInput>
>;

export function classFilterWhere(
    filter: ClassFilter | undefined
): MyPrisma.ClassWhereInput[] {
    return compileFilterWhere(filter, classWhereDefinitions, "class");
}
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
            const filterWhere = classFilterWhere(query.filter);
            const where: MyPrisma.ClassWhereInput =
                filterWhere.length > 0 ? { AND: filterWhere } : {};
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
