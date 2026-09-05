import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createInjectionService } from "../src/registry.js";
import {
    injectDailyMenus,
    normalizeMeal
} from "../src/services/DailyMenusInjection.js";

test("registra daily-menus como injection predefinida", () => {
    const service = createInjectionService({
        name: "daily-menus",
        obtain: {
            command: "node",
            args: [],
            cwd: ".",
            env: {},
            timeoutMs: 1_000
        },
        input: { directory: "data", fileName: "daily-menus.json" },
        options: {},
        allowIssues: true
    });
    assert.equal(typeof service.run, "function");
});

function logger() {
    const changes: unknown[] = [];
    const warnings: unknown[] = [];
    return {
        changes,
        warnings,
        logger: {
            change: (change: unknown) => changes.push(change),
            warn: (value: unknown) => warnings.push(value),
            info: () => undefined
        }
    };
}

function availableMeal() {
    return {
        meal: "lunch",
        label: "Almoço",
        vegan: false,
        status: "available" as const,
        unavailableMessage: null,
        mainDish: " Frango assado ",
        items: ["Arroz", "Feijão", "Arroz"],
        observations: ["Contém glúten"],
        serviceNotes: ["Servido no RU"]
    };
}

test("normaliza refeição para o modelo persistido", () => {
    assert.deepEqual(normalizeMeal(availableMeal()), {
        period: "LUNCH",
        diet: "TRADITIONAL",
        status: "AVAILABLE",
        mainDish: "Frango assado",
        items: ["Arroz", "Feijão"],
        observations: ["Contém glúten"],
        serviceNotes: ["Servido no RU"]
    });
});

test("ignora período não suportado", () => {
    const log = logger();
    assert.equal(
        normalizeMeal(
            { ...availableMeal(), meal: "breakfast", label: "Café da manhã" },
            log.logger as never
        ),
        null
    );
    assert.equal(log.warnings.length, 1);
});

test("normaliza refeição não cadastrada sem persistir a mensagem", () => {
    assert.deepEqual(
        normalizeMeal({
            ...availableMeal(),
            meal: "dinner",
            label: "Jantar Vegano",
            vegan: true,
            status: "not_registered",
            unavailableMessage: "Não há jantar vegano cadastrado!",
            mainDish: null
        }),
        {
            period: "DINNER",
            diet: "VEGAN",
            status: "NOT_REGISTERED",
            mainDish: null,
            items: [],
            observations: [],
            serviceNotes: []
        }
    );
});

test("não altera refeição já sincronizada", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-menus-"));
    const inputPath = join(directory, "daily-menus.json");
    const input = {
        data: {
            firstDate: "2026-08-20",
            lastDate: "2026-08-20",
            menus: [
                {
                    date: "2026-08-20",
                    sourceUrl: "https://example.test/cardapio",
                    meals: [availableMeal()]
                }
            ]
        },
        issues: [],
        pages: []
    };
    await writeFile(inputPath, JSON.stringify(input));
    const log = logger();
    let mutations = 0;
    const prisma = {
        dailyMenu: {
            findMany: async () => [
                {
                    id: 1,
                    date: new Date("2026-08-20T00:00:00.000Z"),
                    meals: [
                        {
                            id: 2,
                            period: "LUNCH",
                            diet: "TRADITIONAL",
                            status: "AVAILABLE",
                            mainDish: "Frango assado",
                            items: [{ text: "Feijão" }, { text: "Arroz" }],
                            observations: [{ text: "Contém glúten" }],
                            serviceNotes: [{ text: "Servido no RU" }]
                        }
                    ]
                }
            ]
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
            callback({
                $executeRaw: async () => undefined,
                dailyMenu: {
                    create: async () => {
                        mutations += 1;
                    }
                },
                meal: {
                    create: async () => {
                        mutations += 1;
                    },
                    update: async () => {
                        mutations += 1;
                    }
                }
            })
    };

    try {
        await injectDailyMenus({
            prisma: prisma as never,
            inputPath,
            runId: "run-id",
            auditContext: {
                source: "injection",
                runId: "run-id",
                injectionName: "daily-menus",
                mode: "all"
            },
            logger: log.logger as never
        });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }

    assert.equal(mutations, 0);
    assert.deepEqual(log.changes, []);
});
