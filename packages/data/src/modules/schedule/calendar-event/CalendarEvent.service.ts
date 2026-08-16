import IO from "#/modules/schedule/calendar-event/CalendarEvent.contract.js";
import calendarEventEntity from "#/modules/schedule/calendar-event/CalendarEvent.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Event = z.infer<typeof IO.schema>;
type Query = z.infer<typeof IO.list.request>["query"];
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
            return (
                await prisma.calendarEvent.findMany({
                    ...calendarEventEntity.prismaSelection,
                    where: {
                        ...(query.endDate
                            ? { startDate: { lte: query.endDate } }
                            : {}),
                        ...(query.startDate
                            ? {
                                  OR: [
                                      { endDate: { gte: query.startDate } },
                                      { endDate: null }
                                  ]
                              }
                            : {}),
                        ...(query.tagId
                            ? { tags: { some: { id: { in: query.tagId } } } }
                            : {})
                    },
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
