import z from "zod";
import { resourcesPaths } from "../../Controllers.js";
import IO from "../../Interfaces/CalendarTagInterface.js";
import { MyPrisma } from "../../PrismaClient.js";

type PrismaCalendarTagPayload = MyPrisma.CalendarTagGetPayload<{
    select: {
        id: true;
        name: true;
    };
}>;

function buildCalendarTagEntity(
    calendarTag: PrismaCalendarTagPayload
): z.infer<typeof IO.schema> {
    return {
        ...calendarTag,
        _paths: {
            entity: resourcesPaths.calendarTag.entity(calendarTag.id)
        }
    };
}

export default {
    build: buildCalendarTagEntity
};
