import {
    CatalogCoursePrerequisiteKind,
    CourseEvaluationMode,
    CourseOfferingPeriod,
    Prisma
} from "@pomi/db";
import { readFile } from "node:fs/promises";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

export type CatalogDisciplinesInjectionOptions = {
    transactionTimeout?: number;
    transactionMaxWait?: number;
    phase?: "catalog" | "relationships" | "all";
};

type Discipline = {
    code: string;
    name: string;
    coordinator: string | null;
    workload: Record<string, number | null>;
    credits: number | null;
    offeringPeriod: string | null;
    evaluation: string | null;
    finalExam: boolean | null;
    minimumAttendancePercent: number | null;
    prerequisites: {
        any: Array<{
            all: Array<
                string | { code: string; kind: "FULL" | "PARTIAL" | "SPECIAL" }
            >;
        }>;
    };
    syllabus: string | null;
    bibliography: string | null;
};

type Prefix = {
    prefix: string;
    url: string;
    courses: Discipline[];
};

type Catalog = { year: number; sourceUrl: string; prefixes: Prefix[] };
type ScrapeInput = { catalogs: Catalog[] };
type ScrapeEnvelope = { data: ScrapeInput; issues?: unknown[] };
type CatalogCourseSource = {
    catalog: Catalog;
    prefix: Prefix;
    discipline: Discipline;
    code: string;
};
type ExistingCourse = {
    id: number;
    code: string;
    name: string;
    credits: number;
    unitId: number | null;
    prefixId: number | null;
};

const offeringPeriods: Record<string, CourseOfferingPeriod> = {
    "todos os períodos": "ALL_PERIODS",
    "1º período - períodos ímpares": "ODD_PERIODS",
    "1o período - períodos impares": "ODD_PERIODS",
    "2º período - períodos pares": "EVEN_PERIODS",
    "2o período - períodos pares": "EVEN_PERIODS",
    "a criterio da unidade de ensino": "UNIT_DISCRETION"
};

const evaluations: Record<string, CourseEvaluationMode> = {
    "nota e frequencia": "GRADE_AND_ATTENDANCE",
    "conceito": "CONCEPT",
    "frequencia": "ATTENDANCE"
};

function normalizeCode(value: string) {
    return value.replace(/\s+/g, "").replace(/\*+$/, "").toUpperCase();
}

function normalizeName(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function period(value: string | null) {
    if (!value) return null;
    return (
        offeringPeriods[
            value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim()
        ] ?? null
    );
}

function evaluation(value: string | null) {
    if (!value) return null;
    return (
        evaluations[
            value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim()
        ] ?? null
    );
}

function issue(message: string, details: Record<string, unknown> = {}) {
    return { message, ...details };
}

function isIgnoredSourceIssue(value: unknown) {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    const invalidAttendance =
        candidate.code === "invalid-format" &&
        candidate.adapter === "catalogo-disciplinas-prefixo" &&
        typeof candidate.path === "string" &&
        candidate.path.endsWith(".minimumAttendancePercent") &&
        candidate.actual === "$disc.perMinFreq%";
    return invalidAttendance;
}

export async function injectCatalogDisciplines(
    { prisma, inputPath, logger }: InjectionContext,
    {
        transactionTimeout = 1_800_000,
        transactionMaxWait = 60_000,
        phase = "all"
    }: CatalogDisciplinesInjectionOptions = {}
) {
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");

    const raw = JSON.parse(await readFile(inputPath, "utf8")) as
        | ScrapeEnvelope
        | ScrapeInput;
    const input = unwrapScrapeData(raw) as ScrapeInput;
    const catalogs = input?.catalogs;
    if (!Array.isArray(catalogs) || catalogs.length === 0)
        throw new Error("Nenhum catálogo encontrado no arquivo de entrada");

    const scrapeIssues =
        "issues" in raw && Array.isArray(raw.issues) ? raw.issues : [];
    const ignoredSourceIssues = scrapeIssues.filter(isIgnoredSourceIssue);
    if (ignoredSourceIssues.length > 0)
        logger.warn(
            { count: ignoredSourceIssues.length },
            "Issues conhecidas da fonte de dados serão ignoradas"
        );
    const errors: unknown[] = [];
    for (const scrapeIssue of scrapeIssues) {
        if (isIgnoredSourceIssue(scrapeIssue)) continue;
        errors.push(scrapeIssue);
        logger.warn({ issue: scrapeIssue }, "Issue recebida do scrapper");
    }
    const changes = [] as Parameters<InjectionContext["logger"]["change"]>[0][];
    if (!["catalog", "relationships", "all"].includes(phase))
        throw new Error(`Fase de injection inválida: ${phase}`);
    const result: Record<string, unknown> = {};
    if (phase === "catalog" || phase === "all")
        result.catalog = await injectCatalogPhase({
            prisma,
            catalogs,
            logger,
            changes,
            errors,
            transactionTimeout,
            transactionMaxWait
        });
    if (phase === "relationships" || phase === "all")
        result.relationships = await injectRelationshipsPhase({
            prisma,
            catalogs,
            logger,
            changes,
            errors,
            transactionTimeout,
            transactionMaxWait
        });
    for (const change of changes) logger.change(change);
    logger.info(
        { phase, result, issues: errors.length },
        "Injeção de disciplinas concluída"
    );
    if (errors.length > 0)
        throw new Error(`Injeção concluída com ${errors.length} issue(s)`);
}

type PhaseContext = {
    prisma: InjectionContext["prisma"];
    catalogs: Catalog[];
    logger: InjectionContext["logger"];
    changes: Parameters<InjectionContext["logger"]["change"]>[0][];
    errors: unknown[];
    transactionTimeout: number;
    transactionMaxWait: number;
};

function sourcesOf(catalogs: Catalog[]): CatalogCourseSource[] {
    return catalogs.flatMap((catalog) =>
        (catalog.prefixes ?? []).flatMap((prefix) =>
            (prefix.courses ?? []).map((discipline) => ({
                catalog,
                prefix,
                discipline,
                code: normalizeCode(discipline.code)
            }))
        )
    );
}

async function setTransactionLimits(
    tx: Prisma.TransactionClient,
    timeout: number
) {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '60000ms'");
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${timeout}ms'`);
}

async function ensureCatalogs(context: PhaseContext) {
    const years = [...new Set(context.catalogs.map(({ year }) => year))];
    await context.prisma.$transaction(
        async (tx) => {
            await setTransactionLimits(tx, context.transactionTimeout);
            for (const year of years)
                await tx.catalog.upsert({
                    where: { year },
                    create: { year },
                    update: {}
                });
        },
        {
            timeout: context.transactionTimeout,
            maxWait: context.transactionMaxWait
        }
    );
}

async function injectCatalogPhase(context: PhaseContext) {
    await ensureCatalogs(context);
    const sources = sourcesOf(context.catalogs);
    const years = [...new Set(context.catalogs.map(({ year }) => year))];
    const prerequisiteCodes = sources.flatMap(({ discipline }) =>
        (discipline.prerequisites?.any ?? []).flatMap(({ all }) =>
            all.map((item) =>
                normalizeCode(
                    (typeof item === "string" ? item : item.code).replace(
                        /^\s*\*/,
                        ""
                    )
                ).replace(/-+$/g, "")
            )
        )
    );
    const codes = [
        ...new Set(
            sources
                .map(({ code }) => code)
                .concat(prerequisiteCodes)
                .filter(Boolean)
        )
    ];
    const [catalogRows, courseRows, coordinatorRows] = await Promise.all([
        context.prisma.catalog.findMany({ where: { year: { in: years } } }),
        context.prisma.course.findMany({
            where: { code: { in: codes } },
            select: {
                id: true,
                code: true,
                name: true,
                credits: true,
                unitId: true,
                prefixId: true
            }
        }),
        context.prisma.coordinator.findMany({
            select: { id: true, name: true }
        })
    ]);
    const catalogIds = new Map(catalogRows.map((row) => [row.year, row.id]));
    const courseByCode = new Map<string, ExistingCourse>(
        courseRows.map((row) => [row.code, row])
    );
    const coordinatorByName = new Map(
        coordinatorRows.map((row) => [normalizeName(row.name), row])
    );
    const catalogCourseRows = await context.prisma.catalogCourse.findMany({
        where: {
            catalogId: { in: [...catalogIds.values()] },
            courseId: { in: courseRows.map(({ id }) => id) }
        },
        select: {
            id: true,
            catalogId: true,
            courseId: true,
            name: true,
            coordinatorId: true,
            theoreticalHours: true,
            practicalHours: true,
            laboratoryHours: true,
            guidedActivityHours: true,
            distanceHours: true,
            guidedExtensionHours: true,
            practicalExtensionHours: true,
            weeks: true,
            weeklyClassHours: true,
            classroomHours: true,
            offeringPeriod: true,
            evaluation: true,
            finalExam: true,
            minimumAttendancePercent: true,
            syllabus: true,
            bibliography: true,
            sourceUrl: true
        }
    });
    const catalogCourseByKey = new Map(
        catalogCourseRows.map((row) => [
            `${row.catalogId}:${row.courseId}`,
            row
        ])
    );
    let imported = 0;
    let skipped = 0;
    let disciplines = 0;
    let savepointCounter = 0;
    const total = sources.length;
    context.logger.info(
        { phase: "catalog", total },
        "Iniciando fase de catálogo"
    );
    const result = await context.prisma.$transaction(
        async (tx) => {
            await setTransactionLimits(tx, context.transactionTimeout);
            for (const source of sources) {
                disciplines += 1;
                if (disciplines === 1 || disciplines % 100 === 0)
                    context.logger.info(
                        {
                            progressPercent: total
                                ? Number(
                                      ((disciplines / total) * 100).toFixed(1)
                                  )
                                : 100
                        },
                        "Progresso da persistência"
                    );
                const catalogId = catalogIds.get(source.catalog.year);
                const savepoint = `catalog_phase_${savepointCounter++}`;
                const changeStart = context.changes.length;
                try {
                    if (
                        !catalogId ||
                        !source.code ||
                        !source.discipline.name.trim()
                    )
                        throw issue("Disciplina sem código, nome ou catálogo", {
                            code: source.code
                        });
                    if (source.discipline.credits === null)
                        throw issue("Disciplina sem créditos", {
                            code: source.code
                        });
                    await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
                    const existingCourse = courseByCode.get(source.code);
                    const courseData = {
                        name: source.discipline.name.trim(),
                        credits: source.discipline.credits,
                        ...(existingCourse?.unitId != null
                            ? { unitId: existingCourse.unitId }
                            : {}),
                        ...(existingCourse?.prefixId != null
                            ? { prefixId: existingCourse.prefixId }
                            : {})
                    };
                    const courseChanged =
                        !existingCourse ||
                        existingCourse.name !== courseData.name ||
                        existingCourse.credits !== courseData.credits;
                    const course = existingCourse
                        ? courseChanged
                            ? await tx.course.update({
                                  where: { id: existingCourse.id },
                                  data: courseData
                              })
                            : existingCourse
                        : await tx.course.create({
                              data: { code: source.code, ...courseData }
                          });
                    courseByCode.set(source.code, course as ExistingCourse);
                    if (!existingCourse)
                        context.changes.push({
                            entity: "Course",
                            operation: "create",
                            key: { id: course.id, code: source.code },
                            before: null,
                            after: { ...courseData, code: source.code }
                        });
                    else if (courseChanged)
                        context.changes.push({
                            entity: "Course",
                            operation: "update",
                            key: { id: course.id, code: source.code },
                            changedFields: ["name", "credits"],
                            before: {
                                name: existingCourse.name,
                                credits: existingCourse.credits
                            },
                            after: {
                                name: courseData.name,
                                credits: courseData.credits
                            }
                        });
                    const coordinatorName =
                        source.discipline.coordinator?.trim();
                    const coordinator = coordinatorName
                        ? coordinatorByName.get(normalizeName(coordinatorName))
                        : undefined;
                    const coordinatorId =
                        coordinator?.id ??
                        (coordinatorName
                            ? (
                                  await tx.coordinator.create({
                                      data: { name: coordinatorName }
                                  })
                              ).id
                            : null);
                    if (coordinatorName && !coordinator) {
                        const created = {
                            id: coordinatorId as number,
                            name: coordinatorName
                        };
                        coordinatorByName.set(
                            normalizeName(coordinatorName),
                            created
                        );
                        context.changes.push({
                            entity: "Coordinator",
                            operation: "create",
                            key: { name: coordinatorName },
                            before: null,
                            after: created
                        });
                    }
                    const data = {
                        name: source.discipline.name.trim(),
                        coordinatorId,
                        ...source.discipline.workload,
                        offeringPeriod: period(
                            source.discipline.offeringPeriod
                        ),
                        evaluation: evaluation(source.discipline.evaluation),
                        finalExam: source.discipline.finalExam,
                        minimumAttendancePercent:
                            source.discipline.minimumAttendancePercent,
                        syllabus: source.discipline.syllabus,
                        bibliography: source.discipline.bibliography,
                        sourceUrl: source.prefix.url
                    };
                    if (
                        source.discipline.offeringPeriod &&
                        !data.offeringPeriod
                    )
                        context.errors.push(
                            issue("Período de oferecimento desconhecido", {
                                catalogYear: source.catalog.year,
                                code: source.code,
                                actual: source.discipline.offeringPeriod
                            })
                        );
                    if (source.discipline.evaluation && !data.evaluation)
                        context.errors.push(
                            issue("Modo de avaliação desconhecido", {
                                catalogYear: source.catalog.year,
                                code: source.code,
                                actual: source.discipline.evaluation
                            })
                        );
                    const key = `${catalogId}:${course.id}`;
                    const existing = catalogCourseByKey.get(key);
                    const changedFields = existing
                        ? Object.keys(data).filter(
                              (field) =>
                                  JSON.stringify(
                                      existing[field as keyof typeof existing]
                                  ) !==
                                  JSON.stringify(
                                      data[field as keyof typeof data]
                                  )
                          )
                        : [];
                    const persisted = existing
                        ? changedFields.length
                            ? await tx.catalogCourse.update({
                                  where: { id: existing.id },
                                  data
                              })
                            : existing
                        : await tx.catalogCourse.create({
                              data: { catalogId, courseId: course.id, ...data }
                          });
                    catalogCourseByKey.set(key, persisted);
                    if (!existing)
                        context.changes.push({
                            entity: "CatalogCourse",
                            operation: "create",
                            key: {
                                id: persisted.id,
                                catalogId,
                                courseId: course.id
                            },
                            before: null,
                            after: data
                        });
                    else if (changedFields.length)
                        context.changes.push({
                            entity: "CatalogCourse",
                            operation: "update",
                            key: {
                                id: persisted.id,
                                catalogId,
                                courseId: course.id
                            },
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
                                    data[field as keyof typeof data]
                                ])
                            )
                        });
                    await tx.$executeRawUnsafe(
                        `RELEASE SAVEPOINT ${savepoint}`
                    );
                    imported += 1;
                } catch (error) {
                    await tx.$executeRawUnsafe(
                        `ROLLBACK TO SAVEPOINT ${savepoint}`
                    );
                    await tx.$executeRawUnsafe(
                        `RELEASE SAVEPOINT ${savepoint}`
                    );
                    context.changes.splice(changeStart);
                    context.errors.push(error);
                    skipped += 1;
                    context.logger.warn(
                        {
                            err: error,
                            catalogYear: source.catalog.year,
                            code: source.code
                        },
                        "Disciplina ignorada"
                    );
                }
            }
            return {
                catalogs: context.catalogs.length,
                disciplines,
                imported,
                skipped
            };
        },
        {
            timeout: context.transactionTimeout,
            maxWait: context.transactionMaxWait
        }
    );
    return result;
}

function prerequisiteGroups(
    source: Discipline,
    courseByCode: Map<string, ExistingCourse>,
    prefixByCode: Map<string, { id: number }>,
    catalogYear: number,
    code: string
) {
    const groups: Array<{
        items: Array<{
            code: string;
            kind: CatalogCoursePrerequisiteKind;
            courseId: number | null;
            prefixId: number | null;
        }>;
    }> = [];
    for (const group of source.prerequisites?.any ?? []) {
        const items = [] as Array<{
            code: string;
            kind: CatalogCoursePrerequisiteKind;
            courseId: number | null;
            prefixId: number | null;
        }>;
        for (const raw of group.all) {
            const input =
                typeof raw === "string"
                    ? {
                          code: raw,
                          kind: /^\s*\*/.test(raw)
                              ? "PARTIAL"
                              : /^AA(?:200|4\d{2})$/i.test(normalizeCode(raw))
                                ? "SPECIAL"
                                : "FULL"
                      }
                    : raw;
            const prerequisiteCode = normalizeCode(
                input.code.replace(/^\s*\*/, "")
            );
            const kind = input.kind as CatalogCoursePrerequisiteKind;
            const course =
                kind === "SPECIAL"
                    ? undefined
                    : courseByCode.get(prerequisiteCode);
            const prefix =
                kind === "SPECIAL"
                    ? undefined
                    : prefixByCode.get(prerequisiteCode.replace(/-+$/g, ""));
            if (kind !== "SPECIAL" && !course && !prefix)
                throw issue("Pré-requis não resolvido", {
                    catalogYear,
                    code,
                    prerequisite: raw
                });
            items.push({
                code: prerequisiteCode,
                kind,
                courseId: course?.id ?? null,
                prefixId: prefix?.id ?? null
            });
        }
        groups.push({ items });
    }
    return groups;
}

function canonicalGroups(
    groups: Array<{
        items: Array<{ code: string; kind: CatalogCoursePrerequisiteKind }>;
    }>
) {
    return groups
        .map((group) =>
            group.items.map(({ code, kind }) => `${code}:${kind}`).sort()
        )
        .sort();
}

async function injectRelationshipsPhase(context: PhaseContext) {
    await ensureCatalogs(context);
    const sources = sourcesOf(context.catalogs);
    const years = [...new Set(context.catalogs.map(({ year }) => year))];
    const catalogRows = await context.prisma.catalog.findMany({
        where: { year: { in: years } }
    });
    const catalogIds = new Map(catalogRows.map((row) => [row.year, row.id]));
    const prerequisiteCodes = sources.flatMap(({ discipline }) =>
        (discipline.prerequisites?.any ?? []).flatMap(({ all }) =>
            all.map((item) =>
                normalizeCode(
                    (typeof item === "string" ? item : item.code).replace(
                        /^\s*\*/,
                        ""
                    )
                ).replace(/-+$/g, "")
            )
        )
    );
    const codes = [
        ...new Set(
            sources
                .map(({ code }) => code)
                .concat(prerequisiteCodes)
                .filter(Boolean)
        )
    ];
    const [courseRows, prefixRows, catalogCourseRows] = await Promise.all([
        context.prisma.course.findMany({
            where: { code: { in: codes } },
            select: {
                id: true,
                code: true,
                name: true,
                credits: true,
                unitId: true,
                prefixId: true
            }
        }),
        context.prisma.prefixes.findMany({
            select: { id: true, prefix: true }
        }),
        context.prisma.catalogCourse.findMany({
            where: { catalogId: { in: [...catalogIds.values()] } },
            include: { prerequisites: { include: { items: true } } }
        })
    ]);
    const courseByCode = new Map(courseRows.map((row) => [row.code, row]));
    const prefixByCode = new Map(
        prefixRows.map((row) => [normalizeCode(row.prefix), row])
    );
    const catalogCourseByKey = new Map(
        catalogCourseRows.map((row) => [
            `${row.catalogId}:${row.courseId}`,
            row
        ])
    );
    let imported = 0;
    let skipped = 0;
    let savepointCounter = 0;
    const result = await context.prisma.$transaction(
        async (tx) => {
            await setTransactionLimits(tx, context.transactionTimeout);
            for (const source of sources) {
                const catalogId = catalogIds.get(source.catalog.year);
                const course = courseByCode.get(source.code);
                const existing =
                    catalogId && course
                        ? catalogCourseByKey.get(`${catalogId}:${course.id}`)
                        : undefined;
                const savepoint = `relationship_phase_${savepointCounter++}`;
                try {
                    await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
                    if (!catalogId || !course || !existing)
                        throw issue("Disciplina base não encontrada", {
                            catalogYear: source.catalog.year,
                            code: source.code
                        });
                    const groups = prerequisiteGroups(
                        source.discipline,
                        courseByCode,
                        prefixByCode,
                        source.catalog.year,
                        source.code
                    );
                    const before = canonicalGroups(
                        existing.prerequisites.map((group) => ({
                            items: group.items.map((item) => ({
                                code: item.code,
                                kind: item.kind
                            }))
                        }))
                    );
                    const after = canonicalGroups(groups);
                    if (JSON.stringify(before) === JSON.stringify(after)) {
                        await tx.$executeRawUnsafe(
                            `RELEASE SAVEPOINT ${savepoint}`
                        );
                        imported += 1;
                        continue;
                    }
                    await tx.catalogCoursePrerequisiteGroup.deleteMany({
                        where: { catalogCourseId: existing.id }
                    });
                    for (const group of groups)
                        await tx.catalogCoursePrerequisiteGroup.create({
                            data: {
                                catalogCourseId: existing.id,
                                items: { create: group.items }
                            }
                        });
                    await tx.$executeRawUnsafe(
                        `RELEASE SAVEPOINT ${savepoint}`
                    );
                    context.changes.push({
                        entity: "CatalogCourse",
                        operation: "update",
                        key: {
                            id: existing.id,
                            catalogId,
                            courseId: course.id
                        },
                        changedFields: ["prerequisites"],
                        before: { groups: before },
                        after: { groups: after }
                    });
                    imported += 1;
                } catch (error) {
                    await tx.$executeRawUnsafe(
                        `ROLLBACK TO SAVEPOINT ${savepoint}`
                    );
                    await tx.$executeRawUnsafe(
                        `RELEASE SAVEPOINT ${savepoint}`
                    );
                    skipped += 1;
                    context.errors.push(error);
                    context.logger.warn(
                        {
                            err: error,
                            catalogYear: source.catalog.year,
                            code: source.code
                        },
                        "Relações da disciplina ignoradas"
                    );
                }
            }
            return { disciplines: sources.length, imported, skipped };
        },
        {
            timeout: context.transactionTimeout,
            maxWait: context.transactionMaxWait
        }
    );
    return result;
}
