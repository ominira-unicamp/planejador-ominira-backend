import type {
    CalendarTagFilter,
    CalendarTagFilterName
} from "#/modules/schedule/calendar-tag/CalendarTag.contract.js";
import IO from "#/modules/schedule/calendar-tag/CalendarTag.contract.js";
import calendarTagEntity from "#/modules/schedule/calendar-tag/CalendarTag.entity.js";
import {
    compileFilterWhere,
    containsAt,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type Tag = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
const calendarTagWhere = prismaWhereFor<MyPrisma.CalendarTagWhereInput>();
const calendarTagWhereDefinitions = {
    id: calendarTagWhere.numberAt("id"),
    name: containsAt<MyPrisma.CalendarTagWhereInput>("name")
} satisfies Record<
    CalendarTagFilterName,
    FilterWhereBuilder<MyPrisma.CalendarTagWhereInput>
>;
export function calendarTagFilterWhere(
    filter: CalendarTagFilter | undefined
): MyPrisma.CalendarTagWhereInput[] {
    return compileFilterWhere(
        filter,
        calendarTagWhereDefinitions,
        "calendar tag"
    );
}
export type CalendarTagService = {
    list(query: Query): Promise<Tag[]>;
    getById(
        id: number
    ): Promise<Result<Tag, ReturnType<typeof ResourceNotFoundProblem.create>>>;
};
export function createCalendarTagService({
    prisma
}: {
    prisma: PrismaClient;
}): CalendarTagService {
    return {
        async list(query) {
            const filterWhere = calendarTagFilterWhere(query.filter);
            return (
                await prisma.calendarTag.findMany({
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                    orderBy: { name: "asc" }
                })
            ).map(calendarTagEntity.build);
        },
        async getById(id) {
            const value = await prisma.calendarTag.findUnique({
                where: { id }
            });
            return value
                ? ok(calendarTagEntity.build(value))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Calendar tag not found"
                      })
                  );
        }
    };
}
