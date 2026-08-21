import IO from "#/modules/schedule/daily-menu/DailyMenu.contract.js";
import dailyMenuEntity from "#/modules/schedule/daily-menu/DailyMenu.entity.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import z from "zod";

type DailyMenu = z.infer<typeof IO.schema>;
type ListQuery = z.infer<typeof IO.list.request>["query"];

export type DailyMenuService = {
    list(query: ListQuery): Promise<DailyMenu[]>;
    getById(
        id: number
    ): Promise<
        Result<DailyMenu, ReturnType<typeof ResourceNotFoundProblem.create>>
    >;
};

export function createDailyMenuService({
    prisma
}: {
    prisma: PrismaClient;
}): DailyMenuService {
    return {
        async list(query) {
            const dailyMenus = await prisma.dailyMenu.findMany({
                ...dailyMenuEntity.prismaSelection,
                where: {
                    date: {
                        ...(query.startDate ? { gte: query.startDate } : {}),
                        ...(query.endDate ? { lte: query.endDate } : {})
                    }
                },
                orderBy: [{ date: "asc" }, { id: "asc" }]
            });
            return dailyMenus.map(dailyMenuEntity.build);
        },
        async getById(id) {
            const dailyMenu = await prisma.dailyMenu.findUnique({
                ...dailyMenuEntity.prismaSelection,
                where: { id }
            });
            return dailyMenu
                ? ok(dailyMenuEntity.build(dailyMenu))
                : err(
                      ResourceNotFoundProblem.create({
                          detail: "Daily menu not found"
                      })
                  );
        }
    };
}
