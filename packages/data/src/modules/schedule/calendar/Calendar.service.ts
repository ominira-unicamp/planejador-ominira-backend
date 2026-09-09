import type { CalendarFilter } from "#/modules/schedule/calendar/CalendarQuery.js";
import { calendarQuerySchema } from "#/modules/schedule/calendar/CalendarQuery.js";
import {
    compileFilterWhere,
    prismaWhereFor,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import type { MyPrisma, PrismaClient } from "@pomi/db";

const calendarWhere = prismaWhereFor<MyPrisma.CalendarEventWhereInput>();
const calendarWhereDefinitions = {
    startDate: (expression) => ({
        OR: [
            { endDate: { gte: new Date(String(expression.values[0])) } },
            { endDate: null }
        ]
    }),
    endDate: (expression) => ({
        startDate: { lte: new Date(String(expression.values[0])) }
    }),
    tagId: calendarWhere.numberAt("tags.some.id")
} satisfies Record<
    string,
    FilterWhereBuilder<MyPrisma.CalendarEventWhereInput>
>;
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
            const filterWhere =
                compileFilterWhere<MyPrisma.CalendarEventWhereInput>(
                    query as CalendarFilter,
                    calendarWhereDefinitions,
                    "calendar feed"
                );
            return prisma.calendarEvent.findMany({
                select: {
                    id: true,
                    startDate: true,
                    endDate: true,
                    description: true,
                    tags: { select: { name: true }, orderBy: { name: "asc" } }
                },
                where: filterWhere.length > 0 ? { AND: filterWhere } : {},
                orderBy: [
                    { startDate: "asc" },
                    { endDate: "asc" },
                    { id: "asc" }
                ]
            });
        }
    };
}
