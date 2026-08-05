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

function readCalendarEvents() {
    const raw = readFileSync(calendarJsonPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
        throw new Error("O arquivo de calendário deve conter uma lista");
    }

    return parsed.map((value, index): CalendarJsonEvent => {
        if (!value || typeof value !== "object") {
            throw new Error(`Registro de calendário inválido: ${index + 1}`);
        }

        const event = value as Partial<CalendarJsonEvent>;
        if (
            typeof event.dataInicio !== "string" ||
            (event.dataFim !== null && typeof event.dataFim !== "string") ||
            typeof event.categoria !== "string" ||
            typeof event.descricao !== "string" ||
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
            descricao: event.descricao.trim()
        };
    });
}

async function main() {
    const calendarEvents = readCalendarEvents();
    const categories = new Set(
        calendarEvents.map((calendarEvent) => calendarEvent.categoria)
    );

    console.log(
        `📅 Injetando ${calendarEvents.length} eventos e ${categories.size} categorias...`
    );

    await prisma.$transaction(async (transaction) => {
        await transaction.calendarEvent.deleteMany();
        await transaction.calendarTag.deleteMany();

        for (const [index, calendarEvent] of calendarEvents.entries()) {
            const startDate = parseDate(
                calendarEvent.dataInicio,
                "dataInicio",
                index
            );
            const endDate = calendarEvent.dataFim
                ? parseDate(calendarEvent.dataFim, "dataFim", index)
                : null;

            await transaction.calendarEvent.create({
                data: {
                    startDate,
                    endDate,
                    description: calendarEvent.descricao,
                    tags: {
                        connectOrCreate: {
                            where: { name: calendarEvent.categoria },
                            create: { name: calendarEvent.categoria }
                        }
                    }
                }
            });
        }
    });

    console.log("✨ Calendário injetado com sucesso!");
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
