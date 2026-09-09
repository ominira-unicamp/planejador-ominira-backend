import type {
    StudyPeriodFilter,
    StudyPeriodFilterName
} from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import IO from "#/modules/schedule/study-period/StudyPeriod.contract.js";
import studyPeriodEntity from "#/modules/schedule/study-period/StudyPeriod.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type StudyPeriod = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const studyPeriodWhere = prismaWhereFor<MyPrisma.StudyPeriodWhereInput>();
const studyPeriodWhereDefinitions = {
    id: studyPeriodWhere.numberAt("id"),
    year: studyPeriodWhere.numberAt("year"),
    yearPeriod: studyPeriodWhere.enumAt("yearPeriod")
} satisfies Record<
    StudyPeriodFilterName,
    FilterWhereBuilder<MyPrisma.StudyPeriodWhereInput>
>;
export function studyPeriodFilterWhere(
    filter: StudyPeriodFilter | undefined
): MyPrisma.StudyPeriodWhereInput[] {
    return compileFilterWhere(
        filter,
        studyPeriodWhereDefinitions,
        "study period"
    );
}
export type StudyPeriodService = {
    list(query: Query): Promise<StudyPeriod[]>;
    getById(
        id: number
    ): Promise<
        Result<StudyPeriod, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createStudyPeriodService({
    prisma
}: {
    prisma: PrismaClient;
}): StudyPeriodService {
    return {
        async list(query) {
            const filterWhere = studyPeriodFilterWhere(query.filter);
            return (
                await prisma.studyPeriod.findMany({
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {}
                })
            ).map(studyPeriodEntity.build);
        },
        async getById(id) {
            const value = await prisma.studyPeriod.findUnique({
                where: { id }
            });
            return value
                ? ok(studyPeriodEntity.build(value))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Study period not found"
                      })
                  );
        }
    };
}
