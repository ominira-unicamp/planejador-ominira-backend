import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../prisma/generated/client.js";

dotenv.config();

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
const calendarJsonPath = join(process.cwd(), ".local", "calendario.json");

interface CalendarJsonEvent {
    dataInicio: string;
    dataFim: string | null;
    categoria: string;
    descricao: string;
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
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
        throw new Error("O arquivo de calendário deve conter uma lista");
    }

    return parsed.map((value, index): ParsedCalendarJsonEvent => {
        if (!value || typeof value !== "object") {
            throw new Error(`Registro de calendário inválido: ${index + 1}`);
        }

        const event = value as Partial<CalendarJsonEvent>;
        if (
            typeof event.dataInicio !== "string" ||
            (event.dataFim !== null && typeof event.dataFim !== "string") ||
            typeof event.categoria !== "string" ||
            typeof event.descricao !== "string" ||
            (event.tags !== undefined &&
                (!Array.isArray(event.tags) ||
                    event.tags.some(
                        (tag) => typeof tag !== "string" || tag.trim() === ""
                    ))) ||
            event.categoria.trim() === "" ||
            event.descricao.trim() === ""
        ) {
            throw new Error(`Registro de calendário inválido: ${index + 1}`);
        }

        const startDate = parseDate(event.dataInicio, "dataInicio", index);
        if (event.dataFim !== null) {
            const endDate = parseDate(event.dataFim, "dataFim", index);
            if (startDate > endDate) {
                throw new Error(
                    `dataFim anterior a dataInicio no registro ${index + 1}`
                );
            }
        }

        return {
            dataInicio: event.dataInicio,
            dataFim: event.dataFim,
            categoria: event.categoria.trim(),
            descricao: event.descricao.trim(),
            tags: Array.from(
                new Set(event.tags?.map((tag) => tag.trim()) ?? [])
            )
        };
    });
}

async function main() {
    const calendarEvents = readCalendarEvents();
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

            for (const [index, calendarEvent] of calendarEvents.entries()) {
                const startDate = parseDate(
                    calendarEvent.dataInicio,
                    "dataInicio",
                    index
                );
                const endDate = calendarEvent.dataFim
                    ? parseDate(calendarEvent.dataFim, "dataFim", index)
                    : null;
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
                const existingEvent = await transaction.calendarEvent.findFirst(
                    {
                        where: {
                            startDate,
                            description: calendarEvent.descricao,
                            OR: endDate
                                ? [{ endDate }]
                                : [{ endDate: null }, { endDate: startDate }]
                        },
                        select: {
                            id: true,
                            tags: { select: { id: true } }
                        }
                    }
                );

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
                        updatedEvents += 1;
                    }
                } else {
                    await transaction.calendarEvent.create({
                        data: {
                            startDate,
                            endDate,
                            description: calendarEvent.descricao,
                            tags: {
                                connect: tagIds.map((id) => ({ id }))
                            }
                        }
                    });
                    createdEvents += 1;
                }
            }

            console.log(
                `✨ Calendário sincronizado: ${createdEvents} eventos criados, ${updatedEvents} eventos enriquecidos.`
            );
        },
        { timeout: 60_000 }
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
