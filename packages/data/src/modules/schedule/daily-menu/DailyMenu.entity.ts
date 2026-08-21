import { resourcesPaths } from "#/Controllers.js";
import IO from "#/modules/schedule/daily-menu/DailyMenu.contract.js";
import { MyPrisma } from "@pomi/db";
import z from "zod";

export const prismaDailyMenuSelection = {
    include: {
        meals: {
            include: {
                items: {
                    select: { text: true },
                    orderBy: [{ text: "asc" }, { id: "asc" }]
                },
                observations: {
                    select: { text: true },
                    orderBy: [{ text: "asc" }, { id: "asc" }]
                },
                serviceNotes: {
                    select: { text: true },
                    orderBy: [{ text: "asc" }, { id: "asc" }]
                }
            },
            orderBy: [{ period: "asc" }, { diet: "asc" }, { id: "asc" }]
        }
    }
} as const satisfies MyPrisma.DailyMenuDefaultArgs;

type PrismaDailyMenuPayload = MyPrisma.DailyMenuGetPayload<
    typeof prismaDailyMenuSelection
>;

function buildDailyMenuEntity(
    dailyMenu: PrismaDailyMenuPayload
): z.infer<typeof IO.schema> {
    return {
        id: dailyMenu.id,
        date: dailyMenu.date.toISOString().slice(0, 10),
        meals: dailyMenu.meals.map((meal) => ({
            id: meal.id,
            period: meal.period,
            diet: meal.diet,
            status: meal.status,
            mainDish: meal.mainDish,
            items: meal.items.map(({ text }) => text),
            observations: meal.observations.map(({ text }) => text),
            serviceNotes: meal.serviceNotes.map(({ text }) => text)
        })),
        createdAt: dailyMenu.createdAt.toISOString(),
        updatedAt: dailyMenu.updatedAt.toISOString(),
        _paths: { self: resourcesPaths.dailyMenu.entity(dailyMenu.id) }
    };
}

export default {
    build: buildDailyMenuEntity,
    prismaSelection: prismaDailyMenuSelection
};
