import { calendarQuerySchema } from "#/modules/schedule/calendar/CalendarQuery.js";
import type { PrismaClient } from "@pomi/db";
export type CalendarService = {
    feed(query: unknown): Promise<
        readonly {
            id: number;
            startDate: Date;
            endDate: Date | null;
            description: string;
            tags: { name: string }[];
        }[]
    >;
};
export function createCalendarService({
    prisma
}: {
    prisma: PrismaClient;
}): CalendarService {
    return {
        async feed(raw) {
            const query = calendarQuerySchema.parse(raw);
            return prisma.calendarEvent.findMany({
                select: {
                    id: true,
                    startDate: true,
                    endDate: true,
                    description: true,
                    tags: { select: { name: true }, orderBy: { name: "asc" } }
                },
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
                    ...(query.tagId !== undefined
                        ? { tags: { some: { id: { in: query.tagId } } } }
                        : {})
                },
                orderBy: [
                    { startDate: "asc" },
                    { endDate: "asc" },
                    { id: "asc" }
                ]
            });
        }
    };
}
