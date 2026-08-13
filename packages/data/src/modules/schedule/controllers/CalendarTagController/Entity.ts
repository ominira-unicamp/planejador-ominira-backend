import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/schedule/contracts/CalendarTagInterface.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

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
