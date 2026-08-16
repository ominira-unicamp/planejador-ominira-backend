import IO from "#/modules/schedule/calendar-tag/CalendarTag.contract.js";
import calendarTagEntity from "#/modules/schedule/calendar-tag/CalendarTag.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";
type Tag = z.infer<typeof IO.schema>;
export type CalendarTagService = {
    list(): Promise<Tag[]>;
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
        async list() {
            return (
                await prisma.calendarTag.findMany({ orderBy: { name: "asc" } })
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
