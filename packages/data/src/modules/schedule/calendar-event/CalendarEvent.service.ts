import type {
    CalendarEventFilter,
    CalendarEventFilterName
} from "#/modules/schedule/calendar-event/CalendarEvent.contract.js";
import IO from "#/modules/schedule/calendar-event/CalendarEvent.contract.js";
import calendarEventEntity from "#/modules/schedule/calendar-event/CalendarEvent.entity.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";
type Event = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];

const calendarEventWhere = prismaWhereFor<MyPrisma.CalendarEventWhereInput>();
const calendarEventWhereDefinitions = {
    startDate: (expression) => ({
        OR: [
            {
                endDate: {
                    gte: new Date(String(expression.values[0]))
                }
            },
            { endDate: null }
        ]
    }),
    endDate: (expression) => ({
        startDate: { lte: new Date(String(expression.values[0])) }
    }),
    tagId: calendarEventWhere.numberAt("tags.some.id")
} satisfies Record<
    CalendarEventFilterName,
    FilterWhereBuilder<MyPrisma.CalendarEventWhereInput>
>;

export function calendarEventFilterWhere(
    filter: CalendarEventFilter | undefined
): MyPrisma.CalendarEventWhereInput[] {
    return compileFilterWhere(
        filter,
        calendarEventWhereDefinitions,
        "calendar event"
    );
}
export type CalendarEventService = {
    list(query: Query): Promise<Event[]>;
    getById(
        id: number
    ): Promise<
        Result<Event, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};
export function createCalendarEventService({
    prisma
}: {
    prisma: PrismaClient;
}): CalendarEventService {
    return {
        async list(query) {
            const filterWhere = calendarEventFilterWhere(query.filter);
            return (
                await prisma.calendarEvent.findMany({
                    ...calendarEventEntity.prismaSelection,
                    where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                    orderBy: [
                        { startDate: "asc" },
                        { endDate: "asc" },
                        { id: "asc" }
                    ]
                })
            ).map(calendarEventEntity.build);
        },
        async getById(id) {
            const value = await prisma.calendarEvent.findUnique({
                ...calendarEventEntity.prismaSelection,
                where: { id }
            });
            return value
                ? ok(calendarEventEntity.build(value))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Calendar event not found"
                      })
                  );
        }
    };
}
