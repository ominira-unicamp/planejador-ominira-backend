import { Prisma } from "@pomi/db";
import { readFile } from "node:fs/promises";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

export type CatalogDisciplinesInjectionOptions = {
    unitCode?: string;
    transactionTimeout?: number;
    transactionMaxWait?: number;
};

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

export async function injectCatalogDisciplines(
    { prisma, inputPath, logger }: InjectionContext,
    {
        unitCode = "DAC",
        transactionTimeout = 1_800_000,
        transactionMaxWait = 60_000
    }: CatalogDisciplinesInjectionOptions = {}
) {
    if (!unitCode.trim()) throw new Error("unitCode deve ser informado");
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");
    const input = unwrapScrapeData(
        JSON.parse(await readFile(inputPath, "utf8"))
    ) as Input | LegacyInput;
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
    const changes = [] as Parameters<InjectionContext["logger"]["change"]>[0][];
    const result = await prisma.$transaction(
        async (tx) => {
            const existingUnit = await tx.unit.findUnique({
                where: { code: unitCode },
                select: { id: true }
            });
            const unit = await tx.unit.upsert({
                where: { code: unitCode },
                create: { code: unitCode },
                update: {}
            });
            if (!existingUnit)
                changes.push({
                    entity: "Unit",
                    operation: "create",
                    key: { code: unitCode },
                    before: null,
                    after: { code: unitCode }
                });
            const prefixCodes = [
                ...new Set(
                    [...latestCourses.values()].map(({ prefix }) => prefix)
                )
            ];
            const existingPrefixCodes = new Set(
                (
                    await tx.prefixes.findMany({
                        where: { prefix: { in: prefixCodes } },
                        select: { prefix: true }
                    })
                ).map(({ prefix }) => prefix)
            );
            await tx.prefixes.createMany({
                data: prefixCodes.map((prefix) => ({
                    prefix,
                    unitId: unit.id
                })),
                skipDuplicates: true
            });
            for (const prefix of prefixCodes)
                if (!existingPrefixCodes.has(prefix))
                    changes.push({
                        entity: "Prefixes",
                        operation: "create",
                        key: { prefix },
                        before: null,
                        after: { prefix, unitId: unit.id }
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
            const existingCourses = new Map(
                (
                    await tx.course.findMany({
                        where: {
                            code: { in: courses.map(({ code }) => code) }
                        },
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            credits: true,
                            prefixId: true
                        }
                    })
                ).map((course) => [course.code, course])
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
            for (const course of courses) {
                const existing = existingCourses.get(course.code);
                if (!existing)
                    changes.push({
                        entity: "Course",
                        operation: "create",
                        key: { code: course.code },
                        before: null,
                        after: course
                    });
                else {
                    const changedFields = [
                        ...(existing.name !== course.name ? ["name"] : []),
                        ...(existing.credits !== course.credits
                            ? ["credits"]
                            : []),
                        ...(existing.prefixId !== course.prefixId
                            ? ["prefixId"]
                            : [])
                    ];
                    if (changedFields.length > 0)
                        changes.push({
                            entity: "Course",
                            operation: "update",
                            key: { id: existing.id, code: course.code },
                            changedFields,
                            before: Object.fromEntries(
                                changedFields.map((field) => [
                                    field,
                                    existing[field as keyof typeof existing]
                                ])
                            ),
                            after: Object.fromEntries(
                                changedFields.map((field) => [
                                    field,
                                    course[field as keyof typeof course]
                                ])
                            )
                        });
                }
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
        { timeout: transactionTimeout, maxWait: transactionMaxWait }
    );
    for (const change of changes) logger.change(change);
    console.log(JSON.stringify(result, null, 2));
}
