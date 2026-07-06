import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "./generated/client.js";

dotenv.config();

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

interface RoomMatch {
    room_code: string;
    objectid_1: string;
}
interface RoomMatchReport {
    matches: RoomMatch[];
}

async function main() {
    const dataPath = join(__dirname, "../seed-data/room_match_report.json");
    const rawData = readFileSync(dataPath, "utf-8");
    const roomMatchReport: RoomMatchReport = JSON.parse(rawData);
    const matchs = roomMatchReport.matches
        .map((match) => ({
            ...match,
            objectid_1: match.objectid_1 ? parseInt(match.objectid_1, 10) : null
        }))
        .filter((match) => match.objectid_1 != null);

    const updates = matchs.map((match) => {
        return prisma.room.update({
            where: {
                code: match.room_code
            },
            data: {
                atlasId: match.objectid_1
            }
        });
    });

    await prisma.$transaction(updates);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Erro durante seeding:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
