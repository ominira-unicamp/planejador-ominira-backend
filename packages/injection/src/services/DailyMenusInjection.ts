import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { InjectionContext } from "./InjectionTypes.js";

const mealInputSchema = z.object({
    meal: z.string(),
    label: z.string(),
    vegan: z.boolean(),
    status: z.enum(["available", "not_registered"]),
    unavailableMessage: z.string().nullable(),
    mainDish: z.string().nullable(),
    items: z.array(z.string()),
    observations: z.array(z.string()),
    serviceNotes: z.array(z.string())
});

const menuInputSchema = z.object({
    date: z.string().date(),
    sourceUrl: z.string(),
    meals: z.array(mealInputSchema)
});

const inputSchema = z.object({
    data: z.object({
        firstDate: z.string().date(),
        lastDate: z.string().date(),
        menus: z.array(menuInputSchema)
    }),
    issues: z.array(z.unknown()).default([]),
    pages: z.array(z.unknown()).default([])
});

type MealInput = z.infer<typeof mealInputSchema>;
type MenuInput = z.infer<typeof menuInputSchema>;
type MealPeriod = "LUNCH" | "DINNER";
type DietaryOption = "TRADITIONAL" | "VEGAN";
type MealStatus = "AVAILABLE" | "NOT_REGISTERED";

export type NormalizedMeal = {
    period: MealPeriod;
    diet: DietaryOption;
    status: MealStatus;
    mainDish: string | null;
    items: string[];
    observations: string[];
    serviceNotes: string[];
};

export type DailyMenusInjectionOptions = {
    transactionTimeout?: number;
    transactionMaxWait?: number;
};

type PersistedMeal = NormalizedMeal & { id: number };
type PersistedMenu = {
    id: number;
    date: Date;
    meals: Array<{
        id: number;
        period: MealPeriod;
        diet: DietaryOption;
        status: MealStatus;
        mainDish: string | null;
        items: Array<{ text: string }>;
        observations: Array<{ text: string }>;
        serviceNotes: Array<{ text: string }>;
    }>;
};

const knownUnavailableMessages = new Map([
    ["DINNER:TRADITIONAL", "Não há jantar cadastrado!"],
    ["DINNER:VEGAN", "Não há jantar vegano cadastrado!"]
]);

function normalizedTexts(values: string[]) {
    return [
        ...new Set(values.map((value) => value.trim()).filter(Boolean))
    ].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function normalizeMeal(
    meal: MealInput,
    logger?: InjectionContext["logger"]
): NormalizedMeal | null {
    const period =
        meal.meal === "lunch"
            ? "LUNCH"
            : meal.meal === "dinner"
              ? "DINNER"
              : null;
    if (!period) {
        logger?.warn(
            { meal: meal.meal, label: meal.label },
            "Período de refeição não suportado; refeição ignorada"
        );
        return null;
    }
    const diet = meal.vegan ? "VEGAN" : "TRADITIONAL";
    const status = meal.status === "available" ? "AVAILABLE" : "NOT_REGISTERED";
    if (status === "AVAILABLE" && !meal.mainDish?.trim())
        throw new Error(
            `Refeição disponível sem prato principal: ${meal.label}`
        );
    if (status === "NOT_REGISTERED") {
        const expected = knownUnavailableMessages.get(`${period}:${diet}`);
        if (meal.unavailableMessage !== expected)
            logger?.warn(
                {
                    period,
                    diet,
                    expected,
                    actual: meal.unavailableMessage
                },
                "Mensagem de refeição indisponível diferente do padrão"
            );
    } else if (meal.unavailableMessage !== null) {
        logger?.warn(
            { period, diet, actual: meal.unavailableMessage },
            "Refeição disponível contém mensagem de indisponibilidade"
        );
    }
    return {
        period,
        diet,
        status,
        mainDish:
            status === "AVAILABLE" ? (meal.mainDish?.trim() ?? null) : null,
        items: status === "AVAILABLE" ? normalizedTexts(meal.items) : [],
        observations:
            status === "AVAILABLE" ? normalizedTexts(meal.observations) : [],
        serviceNotes:
            status === "AVAILABLE" ? normalizedTexts(meal.serviceNotes) : []
    };
}

function persistedMeal(meal: PersistedMenu["meals"][number]): PersistedMeal {
    return {
        id: meal.id,
        period: meal.period,
        diet: meal.diet,
        status: meal.status,
        mainDish: meal.mainDish,
        items: normalizedTexts(meal.items.map(({ text }) => text)),
        observations: normalizedTexts(
            meal.observations.map(({ text }) => text)
        ),
        serviceNotes: normalizedTexts(meal.serviceNotes.map(({ text }) => text))
    };
}

function mealData(meal: NormalizedMeal) {
    return {
        period: meal.period,
        diet: meal.diet,
        status: meal.status,
        mainDish: meal.mainDish
    };
}

function comparableMeal(meal: NormalizedMeal) {
    return JSON.stringify(meal);
}

function relationUpdate(previous: string[], next: string[]) {
    if (JSON.stringify(previous) === JSON.stringify(next)) return undefined;
    return {
        deleteMany: {},
        create: next.map((text) => ({ text }))
    };
}

async function persistMenu({
    context,
    menu,
    existing,
    transactionTimeout,
    transactionMaxWait
}: {
    context: InjectionContext;
    menu: MenuInput;
    existing: PersistedMenu | undefined;
    transactionTimeout: number;
    transactionMaxWait: number;
}) {
    const normalized = menu.meals.flatMap((meal) => {
        const value = normalizeMeal(meal, context.logger);
        return value ? [value] : [];
    });
    const keys = new Set<string>();
    for (const meal of normalized) {
        const key = `${meal.period}:${meal.diet}`;
        if (keys.has(key))
            throw new Error(`Refeição duplicada em ${menu.date}: ${key}`);
        keys.add(key);
    }
    if (normalized.length === 0) return [];

    return context.prisma.$transaction(
        async (tx) => {
            const changes = [] as Parameters<
                InjectionContext["logger"]["change"]
            >[0][];
            const dailyMenu = existing
                ? { id: existing.id }
                : await tx.dailyMenu.create({
                      data: {
                          date: new Date(`${menu.date}T00:00:00.000Z`)
                      },
                      select: { id: true }
                  });
            if (!existing)
                changes.push({
                    entity: "DailyMenu",
                    operation: "create",
                    key: { id: dailyMenu.id, date: menu.date },
                    before: null,
                    after: { date: menu.date }
                });

            const existingMeals = new Map(
                (existing?.meals ?? []).map((meal) => {
                    const persisted = persistedMeal(meal);
                    return [`${persisted.period}:${persisted.diet}`, persisted];
                })
            );
            for (const meal of normalized) {
                const key = `${meal.period}:${meal.diet}`;
                const previous = existingMeals.get(key);
                if (!previous) {
                    const created = await tx.meal.create({
                        data: {
                            dailyMenuId: dailyMenu.id,
                            ...mealData(meal),
                            items: {
                                create: meal.items.map((text) => ({ text }))
                            },
                            observations: {
                                create: meal.observations.map((text) => ({
                                    text
                                }))
                            },
                            serviceNotes: {
                                create: meal.serviceNotes.map((text) => ({
                                    text
                                }))
                            }
                        },
                        select: { id: true }
                    });
                    changes.push({
                        entity: "Meal",
                        operation: "create",
                        key: {
                            id: created.id,
                            date: menu.date,
                            period: meal.period,
                            diet: meal.diet
                        },
                        before: null,
                        after: meal
                    });
                    continue;
                }
                const { id, ...previousData } = previous;
                if (comparableMeal(previousData) === comparableMeal(meal))
                    continue;
                await tx.meal.update({
                    where: { id },
                    data: {
                        ...mealData(meal),
                        items: relationUpdate(previous.items, meal.items),
                        observations: relationUpdate(
                            previous.observations,
                            meal.observations
                        ),
                        serviceNotes: relationUpdate(
                            previous.serviceNotes,
                            meal.serviceNotes
                        )
                    }
                });
                changes.push({
                    entity: "Meal",
                    operation: "update",
                    key: {
                        id,
                        date: menu.date,
                        period: meal.period,
                        diet: meal.diet
                    },
                    before: previousData,
                    after: meal,
                    changedFields: Object.keys(meal).filter(
                        (field) =>
                            JSON.stringify(
                                previousData[field as keyof typeof previousData]
                            ) !==
                            JSON.stringify(meal[field as keyof typeof meal])
                    )
                });
            }
            return changes;
        },
        { timeout: transactionTimeout, maxWait: transactionMaxWait }
    );
}

export async function injectDailyMenus(
    context: InjectionContext,
    {
        transactionTimeout = 60_000,
        transactionMaxWait = 10_000
    }: DailyMenusInjectionOptions = {}
) {
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");
    const input = inputSchema.parse(
        JSON.parse(await readFile(context.inputPath, "utf8"))
    );
    for (const issue of input.issues)
        context.logger.warn({ issue }, "Issue recebida do scrapper");

    const firstDate = new Date(`${input.data.firstDate}T00:00:00.000Z`);
    const lastDate = new Date(`${input.data.lastDate}T00:00:00.000Z`);
    const existing = (await context.prisma.dailyMenu.findMany({
        where: { date: { gte: firstDate, lte: lastDate } },
        include: {
            meals: {
                include: {
                    items: { select: { text: true } },
                    observations: { select: { text: true } },
                    serviceNotes: { select: { text: true } }
                }
            }
        }
    })) as PersistedMenu[];
    const existingByDate = new Map(
        existing.map((menu) => [menu.date.toISOString().slice(0, 10), menu])
    );
    const dates = new Set<string>();
    const errors: unknown[] = [];
    let changesCount = 0;
    for (const menu of input.data.menus) {
        if (context.signal?.aborted)
            throw context.signal.reason ?? new Error("Injection cancelada");
        if (dates.has(menu.date)) {
            errors.push(new Error(`Cardápio duplicado para ${menu.date}`));
            continue;
        }
        dates.add(menu.date);
        try {
            const changes = await persistMenu({
                context,
                menu,
                existing: existingByDate.get(menu.date),
                transactionTimeout,
                transactionMaxWait
            });
            for (const change of changes) context.logger.change(change);
            changesCount += changes.length;
        } catch (error) {
            errors.push(error);
            context.logger.warn(
                { err: error, date: menu.date },
                "Cardápio ignorado"
            );
        }
    }
    context.logger.info(
        {
            menus: input.data.menus.length,
            changes: changesCount,
            sourceIssues: input.issues.length,
            persistenceIssues: errors.length
        },
        "Injeção de cardápios concluída"
    );
    if (errors.length > 0)
        throw new AggregateError(
            errors,
            `Falha em ${errors.length} cardápio(s)`
        );
}
