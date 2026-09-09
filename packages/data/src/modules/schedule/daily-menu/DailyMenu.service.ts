import type {
    DailyMenuFilter,
    DailyMenuFilterName
} from "#/modules/schedule/daily-menu/DailyMenu.contract.js";
import IO from "#/modules/schedule/daily-menu/DailyMenu.contract.js";
import dailyMenuEntity from "#/modules/schedule/daily-menu/DailyMenu.entity.js";
import {
    compileFilterWhere,
    dateAt,
    type FilterWhereBuilder
} from "#/queryFilterWhere.js";
import { err, ok, ResourceNotFoundProblem, type Result } from "@pomi/api-core";
import type { MyPrisma, PrismaClient } from "@pomi/db";
import z from "zod";

type DailyMenu = z.infer<typeof IO.schema>;
type ListQuery = z.infer<typeof IO.list.request>["query"];

const dailyMenuWhereDefinitions = {
    date: dateAt<MyPrisma.DailyMenuWhereInput>("date")
} satisfies Record<
    DailyMenuFilterName,
    FilterWhereBuilder<MyPrisma.DailyMenuWhereInput>
>;

export function dailyMenuFilterWhere(
    filter: DailyMenuFilter | undefined
): MyPrisma.DailyMenuWhereInput[] {
    return compileFilterWhere(filter, dailyMenuWhereDefinitions, "daily menu");
}

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
            const filterWhere = dailyMenuFilterWhere(query.filter);
            const dailyMenus = await prisma.dailyMenu.findMany({
                ...dailyMenuEntity.prismaSelection,
                where: filterWhere.length > 0 ? { AND: filterWhere } : {},
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
