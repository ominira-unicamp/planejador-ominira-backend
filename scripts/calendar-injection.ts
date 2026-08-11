import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../prisma/generated/client.js";
import { unwrapScrapeData } from "./scrape-input.js";

dotenv.config();

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
const calendarJsonPath = join(process.cwd(), ".local", "calendario.json");
const transactionTimeout = Number(
    process.env.CALENDAR_TRANSACTION_TIMEOUT_MS ?? "600000"
);
if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
    throw new Error(
        "CALENDAR_TRANSACTION_TIMEOUT_MS deve ser um inteiro positivo"
    );

interface CalendarJsonEvent {
    dataInicio: string;
    dataFim: string | null;
    categoria: string;
    descricao: string;
    tags?: string[];
}

interface NativeCalendarJsonEvent {
    startDate: string;
    endDate: string | null;
    category: string;
    description: string;
    tags?: string[];
}

interface ParsedCalendarJsonEvent extends CalendarJsonEvent {
    tags: string[];
}

function parseDate(value: string, field: string, index: number) {
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) {
        throw new Error(
            `Data inválida em ${field} do registro ${index + 1}: ${value}`
        );
    }

    const [, day, month, year] = match;
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) ||
        date.getUTCDate() !== Number(day)
    ) {
        throw new Error(
            `Data inválida em ${field} do registro ${index + 1}: ${value}`
        );
    }

    return date;
}

function readCalendarEvents(): ParsedCalendarJsonEvent[] {
    const raw = readFileSync(calendarJsonPath, "utf-8");
    const parsed = unwrapScrapeData(JSON.parse(raw));

    if (!Array.isArray(parsed)) {
        throw new Error("O arquivo de calendário deve conter uma lista");
    }

    return parsed.map((value, index): ParsedCalendarJsonEvent => {
        if (!value || typeof value !== "object") {
            throw new Error(`Registro de calendário inválido: ${index + 1}`);
        }

        const event = value as Partial<
            CalendarJsonEvent & NativeCalendarJsonEvent
        >;
        const dataInicio = event.startDate ?? event.dataInicio;
        const dataFim = event.endDate ?? event.dataFim;
        const categoria = event.category ?? event.categoria;
        const descricao = event.description ?? event.descricao;
        if (
            typeof dataInicio !== "string" ||
            (dataFim !== null && typeof dataFim !== "string") ||
            typeof categoria !== "string" ||
            typeof descricao !== "string" ||
            (event.tags !== undefined &&
                (!Array.isArray(event.tags) ||
                    event.tags.some(
                        (tag) => typeof tag !== "string" || tag.trim() === ""
                    ))) ||
            categoria.trim() === "" ||
            descricao.trim() === ""
        ) {
            throw new Error(`Registro de calendário inválido: ${index + 1}`);
        }

        const startDate = parseDate(dataInicio, "startDate", index);
        if (dataFim !== null) {
            const endDate = parseDate(dataFim, "endDate", index);
            if (startDate > endDate) {
                throw new Error(
                    `endDate anterior a startDate no registro ${index + 1}`
                );
            }
        }

        return {
            dataInicio,
            dataFim,
            categoria: categoria.trim(),
            descricao: descricao.trim(),
            tags: Array.from(
                new Set(event.tags?.map((tag) => tag.trim()) ?? [])
            )
        };
    });
}

async function main() {
    const calendarEvents = readCalendarEvents();
    const normalizedEvents = calendarEvents.map((calendarEvent, index) => ({
        ...calendarEvent,
        startDate: parseDate(calendarEvent.dataInicio, "dataInicio", index),
        endDate: calendarEvent.dataFim
            ? parseDate(calendarEvent.dataFim, "dataFim", index)
            : null,
        index
    }));
    const tagNames = new Set(
        calendarEvents.flatMap((calendarEvent) => [
            calendarEvent.categoria,
            ...calendarEvent.tags
        ])
    );

    console.log(
        `📅 Sincronizando ${calendarEvents.length} eventos e ${tagNames.size} tags...`
    );

    await prisma.$transaction(
        async (transaction) => {
            await transaction.calendarTag.createMany({
                data: Array.from(tagNames, (name) => ({ name })),
                skipDuplicates: true
            });

            const calendarTags = await transaction.calendarTag.findMany({
                select: { id: true, name: true }
            });
            const tagIdByName = new Map(
                calendarTags.map((calendarTag) => [
                    calendarTag.name,
                    calendarTag.id
                ])
            );

            let createdEvents = 0;
            let updatedEvents = 0;
            const existingEvents = await transaction.calendarEvent.findMany({
                where: {
                    startDate: {
                        in: normalizedEvents.map(({ startDate }) => startDate)
                    },
                    description: {
                        in: normalizedEvents.map(({ descricao }) => descricao)
                    }
                },
                select: {
                    id: true,
                    startDate: true,
                    endDate: true,
                    description: true,
                    tags: { select: { id: true } }
                }
            });
            const eventKey = (
                startDate: Date,
                endDate: Date | null,
                description: string
            ) =>
                `${startDate.toISOString()}\u0000${endDate?.toISOString() ?? ""}\u0000${description}`;
            const existingByKey = new Map(
                existingEvents.flatMap((event) => {
                    const entries: Array<
                        [string, { id: number; tags: Array<{ id: number }> }]
                    > = [
                        [
                            eventKey(
                                event.startDate,
                                event.endDate,
                                event.description
                            ),
                            event
                        ]
                    ];
                    if (event.endDate?.getTime() === event.startDate.getTime())
                        entries.push([
                            eventKey(event.startDate, null, event.description),
                            event
                        ]);
                    return entries;
                })
            );

            for (const calendarEvent of normalizedEvents) {
                const { startDate, endDate, index } = calendarEvent;
                const eventTagNames = [
                    calendarEvent.categoria,
                    ...calendarEvent.tags
                ];
                const tagIds = eventTagNames.map((tagName) => {
                    const tagId = tagIdByName.get(tagName);

                    if (tagId === undefined) {
                        throw new Error(
                            `Tag não encontrada no registro ${index + 1}: ${tagName}`
                        );
                    }

                    return tagId;
                });
                const key = eventKey(
                    startDate,
                    endDate,
                    calendarEvent.descricao
                );
                const existingEvent = existingByKey.get(key);

                if (existingEvent) {
                    const existingTagIds = new Set(
                        existingEvent.tags.map((tag) => tag.id)
                    );
                    const missingTagIds = tagIds.filter(
                        (tagId) => !existingTagIds.has(tagId)
                    );

                    if (missingTagIds.length > 0) {
                        await transaction.calendarEvent.update({
                            where: { id: existingEvent.id },
                            data: {
                                tags: {
                                    connect: missingTagIds.map((id) => ({ id }))
                                }
                            }
                        });
                        existingEvent.tags.push(
                            ...missingTagIds.map((id) => ({ id }))
                        );
                        updatedEvents += 1;
                    }
                } else {
                    const createdEvent = await transaction.calendarEvent.create(
                        {
                            data: {
                                startDate,
                                endDate,
                                description: calendarEvent.descricao,
                                tags: {
                                    connect: tagIds.map((id) => ({ id }))
                                }
                            },
                            select: { id: true }
                        }
                    );
                    existingByKey.set(key, {
                        id: createdEvent.id,
                        tags: tagIds.map((id) => ({ id }))
                    });
                    createdEvents += 1;
                }
            }

            console.log(
                `✨ Calendário sincronizado: ${createdEvents} eventos criados, ${updatedEvents} eventos enriquecidos.`
            );
        },
        { timeout: transactionTimeout, maxWait: 60_000 }
    );

    console.log("✨ Injeção incremental concluída com sucesso!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error("❌ Erro durante a injeção do calendário:", error);
        await prisma.$disconnect();
        process.exit(1);
    });
