import { resourcesPaths } from "#/Controllers.js";
import { MyPrisma } from "#/PrismaClient.js";
import IO from "#/modules/schedule/contracts/CalendarEventInterface.js";
import z from "zod";

export const prismaCalendarEventFieldSelection = {
    include: {
        tags: {
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: "asc"
            }
        }
    }
} as const satisfies MyPrisma.CalendarEventDefaultArgs;

type PrismaCalendarEventPayload = MyPrisma.CalendarEventGetPayload<
    typeof prismaCalendarEventFieldSelection
>;

function buildCalendarEventEntity(
    calendarEvent: PrismaCalendarEventPayload
): z.infer<typeof IO.schema> {
    return {
        ...calendarEvent,
        _paths: {
            entity: resourcesPaths.calendarEvent.entity(calendarEvent.id)
        }
    };
}

export default {
    build: buildCalendarEventEntity,
    prismaSelection: prismaCalendarEventFieldSelection
};
