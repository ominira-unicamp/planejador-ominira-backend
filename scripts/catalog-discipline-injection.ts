import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "../prisma/generated/client.js";

dotenv.config();

const inputPath = resolve(
    process.env.CATALOG_DISCIPLINES_INPUT ??
        resolve(import.meta.dirname, "../../scrapper/catalogo_disciplinas.json")
);
const unitCode = process.env.CATALOG_DISCIPLINES_UNIT_CODE ?? "DAC";
const transactionTimeout = Number(
    process.env.CATALOG_DISCIPLINES_TRANSACTION_TIMEOUT_MS ?? "1800000"
);
if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
    throw new Error(
        "CATALOG_DISCIPLINES_TRANSACTION_TIMEOUT_MS deve ser um inteiro positivo"
    );
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

type CourseInput = { code: string; name: string; credits: number };
type PrefixInput = { prefix: string; courses: CourseInput[] };
type CatalogInput = { year: number; prefixes: PrefixInput[] };
type Input = { catalogs: CatalogInput[] };
type LegacyInput = CatalogInput;
type LatestCourse = {
    year: number;
    prefix: string;
    course: CourseInput;
};

function normalize(value: string) {
    return value.replace(/\s+/g, "").toUpperCase();
}

async function main() {
    const input = JSON.parse(await readFile(inputPath, "utf8")) as
        | Input
        | LegacyInput;
    const catalogs = "catalogs" in input ? input.catalogs : [input];
    if (catalogs.length === 0)
        throw new Error("Nenhum catálogo encontrado no arquivo de entrada");
    const latestCourses = new Map<string, LatestCourse>();
    for (const catalog of catalogs) {
        for (const prefix of catalog.prefixes) {
            for (const course of prefix.courses) {
                const code = normalize(course.code);
                const current = latestCourses.get(code);
                if (!current || catalog.year > current.year)
                    latestCourses.set(code, {
                        year: catalog.year,
                        prefix: normalize(prefix.prefix),
                        course
                    });
            }
        }
    }
    if (latestCourses.size === 0)
        throw new Error("Nenhuma disciplina encontrada nos catálogos");
    const result = await prisma.$transaction(
        async (tx) => {
            const unit = await tx.unit.upsert({
                where: { code: unitCode },
                create: { code: unitCode },
                update: {}
            });
            const prefixCodes = [
                ...new Set(
                    [...latestCourses.values()].map(({ prefix }) => prefix)
                )
            ];
            await tx.prefixes.createMany({
                data: prefixCodes.map((prefix) => ({
                    prefix,
                    unitId: unit.id
                })),
                skipDuplicates: true
            });
            const persistedPrefixes = new Map(
                (
                    await tx.prefixes.findMany({
                        where: { prefix: { in: prefixCodes } },
                        select: { id: true, prefix: true }
                    })
                ).map((prefix) => [prefix.prefix, prefix.id])
            );
            const courses = [...latestCourses.values()].map(
                ({ prefix, course }) => {
                    const prefixId = persistedPrefixes.get(prefix);
                    if (!prefixId)
                        throw new Error(`Prefixo não persistido: ${prefix}`);
                    return {
                        code: normalize(course.code),
                        name: course.name,
                        credits: course.credits,
                        prefixId
                    };
                }
            );
            for (let start = 0; start < courses.length; start += 500) {
                const rows = courses
                    .slice(start, start + 500)
                    .map(
                        (course) =>
                            Prisma.sql`(${course.code}, ${course.name}, ${course.credits}, ${unit.id}, ${course.prefixId})`
                    );
                await tx.$executeRaw`
                    INSERT INTO "Course" ("code", "name", "credits", "unitId", "prefixId")
                    VALUES ${Prisma.join(rows)}
                    ON CONFLICT ("code") DO UPDATE SET
                        "name" = EXCLUDED."name",
                        "credits" = EXCLUDED."credits",
                        "prefixId" = EXCLUDED."prefixId"
                `;
            }
            const years = catalogs.map(({ year }) => year);
            return {
                firstYear: Math.min(...years),
                lastYear: Math.max(...years),
                prefixes: prefixCodes.length,
                courses: latestCourses.size,
                unitCode
            };
        },
        { timeout: transactionTimeout, maxWait: 60_000 }
    );
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((error: unknown) => {
        console.error("Falha na injeção das disciplinas:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
