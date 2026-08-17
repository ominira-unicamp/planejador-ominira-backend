import {
    CatalogCoursePrerequisiteKind,
    CourseEvaluationMode,
    CourseOfferingPeriod
} from "@pomi/db";
import { readFile } from "node:fs/promises";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

export type CatalogDisciplinesInjectionOptions = {
    transactionTimeout?: number;
    transactionMaxWait?: number;
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
        transactionMaxWait = 60_000
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
    logger.info(
        { catalogs: catalogs.length, issues: errors.length },
        "Iniciando persistência da injection"
    );
    const changes = [] as Parameters<InjectionContext["logger"]["change"]>[0][];
    const result = await prisma.$transaction(
        async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '60000ms'");
            await tx.$executeRawUnsafe(
                `SET LOCAL statement_timeout = '${transactionTimeout}ms'`
            );
            let disciplines = 0;
            let imported = 0;
            let skipped = 0;
            let savepointCounter = 0;
            const totalDisciplines = catalogs.reduce(
                (total, catalog) =>
                    total +
                    (catalog.prefixes ?? []).reduce(
                        (prefixTotal, prefix) =>
                            prefixTotal + (prefix.courses ?? []).length,
                        0
                    ),
                0
            );

            for (const catalogInput of catalogs) {
                logger.info(
                    { catalogYear: catalogInput.year },
                    "Iniciando persistência do catálogo"
                );
                const catalog = await tx.catalog.upsert({
                    where: { year: catalogInput.year },
                    create: { year: catalogInput.year },
                    update: {}
                });
                const existingCatalogCourses = new Set(
                    (
                        await tx.catalogCourse.findMany({
                            where: { catalogId: catalog.id },
                            select: { course: { select: { code: true } } }
                        })
                    ).map(({ course }) => course.code)
                );
                const seenCatalogCourses = new Set<string>();

                for (const prefix of catalogInput.prefixes ?? []) {
                    for (const source of prefix.courses ?? []) {
                        disciplines += 1;
                        if (disciplines === 1 || disciplines % 100 === 0)
                            logger.info(
                                {
                                    progressPercent:
                                        totalDisciplines === 0
                                            ? 100
                                            : Number(
                                                  (
                                                      (disciplines /
                                                          totalDisciplines) *
                                                      100
                                                  ).toFixed(1)
                                              )
                                },
                                "Progresso da persistência"
                            );
                        const code = normalizeCode(source.code);
                        seenCatalogCourses.add(code);
                        const changeStart = changes.length;
                        try {
                            const savepoint = `catalog_discipline_${savepointCounter++}`;
                            await tx.$executeRawUnsafe(
                                `SAVEPOINT ${savepoint}`
                            );
                            if (!code || !source.name.trim())
                                throw issue("Disciplina sem código ou nome", {
                                    code: source.code
                                });
                            if (source.credits === null)
                                throw issue("Disciplina sem créditos", {
                                    code
                                });

                            const existingCourse = await tx.course.findUnique({
                                where: { code },
                                select: {
                                    id: true,
                                    code: true,
                                    name: true,
                                    credits: true,
                                    unitId: true,
                                    prefixId: true
                                }
                            });
                            const courseUpdate = {
                                name: source.name.trim(),
                                credits: source.credits,
                                ...(existingCourse?.unitId !== null &&
                                existingCourse?.unitId !== undefined
                                    ? { unitId: existingCourse.unitId }
                                    : {}),
                                ...(existingCourse?.prefixId !== null &&
                                existingCourse?.prefixId !== undefined
                                    ? { prefixId: existingCourse.prefixId }
                                    : {})
                            };
                            const course = await tx.course.upsert({
                                where: { code },
                                create: {
                                    code,
                                    name: source.name.trim(),
                                    credits: source.credits
                                },
                                update: courseUpdate
                            });
                            const courseChangedFields = [
                                ...(existingCourse?.name !== source.name.trim()
                                    ? ["name"]
                                    : []),
                                ...(existingCourse?.credits !== source.credits
                                    ? ["credits"]
                                    : [])
                            ];
                            if (!existingCourse)
                                changes.push({
                                    entity: "Course",
                                    operation: "create",
                                    key: { id: course.id, code },
                                    before: null,
                                    after: {
                                        code,
                                        name: source.name.trim(),
                                        credits: source.credits,
                                        unitId: null,
                                        prefixId: null
                                    }
                                });
                            else if (courseChangedFields.length > 0)
                                changes.push({
                                    entity: "Course",
                                    operation: "update",
                                    key: { id: course.id, code },
                                    changedFields: courseChangedFields,
                                    before: Object.fromEntries(
                                        courseChangedFields.map((field) => [
                                            field,
                                            existingCourse[
                                                field as keyof typeof existingCourse
                                            ]
                                        ])
                                    ),
                                    after: Object.fromEntries(
                                        courseChangedFields.map((field) => [
                                            field,
                                            course[field as keyof typeof course]
                                        ])
                                    )
                                });
                            const coordinatorName = source.coordinator?.trim();
                            let coordinatorId: number | null = null;
                            if (coordinatorName) {
                                const coordinators =
                                    await tx.coordinator.findMany({
                                        select: { id: true, name: true }
                                    });
                                const existing = coordinators.find(
                                    ({ name }) =>
                                        normalizeName(name) ===
                                        normalizeName(coordinatorName)
                                );
                                coordinatorId = existing
                                    ? existing.id
                                    : (
                                          await tx.coordinator.create({
                                              data: { name: coordinatorName }
                                          })
                                      ).id;
                                if (!existing)
                                    changes.push({
                                        entity: "Coordinator",
                                        operation: "create",
                                        key: { name: coordinatorName },
                                        before: null,
                                        after: {
                                            id: coordinatorId,
                                            name: coordinatorName
                                        }
                                    });
                            }

                            const normalizedPeriod = period(
                                source.offeringPeriod
                            );
                            if (source.offeringPeriod && !normalizedPeriod) {
                                errors.push(
                                    issue(
                                        "Período de oferecimento desconhecido",
                                        {
                                            catalogYear: catalogInput.year,
                                            code,
                                            actual: source.offeringPeriod
                                        }
                                    )
                                );
                            }
                            const normalizedEvaluation = evaluation(
                                source.evaluation
                            );
                            if (source.evaluation && !normalizedEvaluation)
                                errors.push(
                                    issue("Modo de avaliação desconhecido", {
                                        catalogYear: catalogInput.year,
                                        code,
                                        actual: source.evaluation
                                    })
                                );

                            const prerequisiteGroups = [] as Array<{
                                items: Array<{
                                    code: string;
                                    kind: CatalogCoursePrerequisiteKind;
                                    courseId: number | null;
                                    prefixId: number | null;
                                }>;
                            }>;
                            for (const group of source.prerequisites?.any ??
                                []) {
                                const items = [] as Array<{
                                    code: string;
                                    kind: CatalogCoursePrerequisiteKind;
                                    courseId: number | null;
                                    prefixId: number | null;
                                }>;
                                for (const rawCode of group.all) {
                                    const prerequisiteInput =
                                        typeof rawCode === "string"
                                            ? {
                                                  code: rawCode,
                                                  kind: /^\s*\*/.test(rawCode)
                                                      ? "PARTIAL"
                                                      : /^AA(?:200|4\d{2})$/i.test(
                                                              normalizeCode(
                                                                  rawCode
                                                              )
                                                          )
                                                        ? "SPECIAL"
                                                        : "FULL"
                                              }
                                            : rawCode;
                                    const prerequisiteCode = normalizeCode(
                                        prerequisiteInput.code.replace(
                                            /^\s*\*/,
                                            ""
                                        )
                                    );
                                    const prerequisiteKind =
                                        prerequisiteInput.kind as CatalogCoursePrerequisiteKind;
                                    const prerequisiteCourse =
                                        prerequisiteKind === "SPECIAL"
                                            ? null
                                            : await tx.course.findUnique({
                                                  where: {
                                                      code: prerequisiteCode
                                                  },
                                                  select: { id: true }
                                              });
                                    const prefixCode = prerequisiteCode.replace(
                                        /-+$/g,
                                        ""
                                    );
                                    const prerequisitePrefix =
                                        prerequisiteKind === "SPECIAL"
                                            ? null
                                            : await tx.prefixes.findUnique({
                                                  where: { prefix: prefixCode },
                                                  select: { id: true }
                                              });
                                    if (
                                        prerequisiteKind !== "SPECIAL" &&
                                        !prerequisiteCourse &&
                                        !prerequisitePrefix
                                    )
                                        throw issue(
                                            "Pré-requis não resolvido",
                                            {
                                                catalogYear: catalogInput.year,
                                                code,
                                                prerequisite: rawCode
                                            }
                                        );
                                    items.push({
                                        code: prerequisiteCode,
                                        kind: prerequisiteKind,
                                        courseId:
                                            prerequisiteCourse?.id ?? null,
                                        prefixId: prerequisitePrefix?.id ?? null
                                    });
                                }
                                prerequisiteGroups.push({ items });
                            }

                            const existing = await tx.catalogCourse.findUnique({
                                where: {
                                    catalogId_courseId: {
                                        catalogId: catalog.id,
                                        courseId: course.id
                                    }
                                },
                                include: {
                                    prerequisites: {
                                        include: {
                                            items: true
                                        }
                                    }
                                }
                            });
                            const data = {
                                name: source.name.trim(),
                                coordinatorId,
                                ...source.workload,
                                offeringPeriod: normalizedPeriod,
                                evaluation: normalizedEvaluation,
                                finalExam: source.finalExam,
                                minimumAttendancePercent:
                                    source.minimumAttendancePercent,
                                syllabus: source.syllabus,
                                bibliography: source.bibliography,
                                sourceUrl: prefix.url
                            };
                            const persisted = await tx.catalogCourse.upsert({
                                where: {
                                    catalogId_courseId: {
                                        catalogId: catalog.id,
                                        courseId: course.id
                                    }
                                },
                                create: {
                                    catalogId: catalog.id,
                                    courseId: course.id,
                                    ...data,
                                    prerequisites: {
                                        create: prerequisiteGroups.map(
                                            (group) => ({
                                                items: {
                                                    create: group.items.map(
                                                        (item) => item
                                                    )
                                                }
                                            })
                                        )
                                    }
                                },
                                update: data
                            });
                            if (existing) {
                                const changedFields = Object.keys(data).filter(
                                    (field) =>
                                        JSON.stringify(
                                            existing[
                                                field as keyof typeof existing
                                            ]
                                        ) !==
                                        JSON.stringify(
                                            data[field as keyof typeof data]
                                        )
                                );
                                const beforePrerequisites =
                                    existing.prerequisites.map((group) =>
                                        group.items.map((item) => ({
                                            code: item.code,
                                            kind: item.kind
                                        }))
                                    );
                                const afterPrerequisites =
                                    prerequisiteGroups.map((group) =>
                                        group.items.map((item) => ({
                                            code: item.code,
                                            kind: item.kind
                                        }))
                                    );
                                if (
                                    JSON.stringify(beforePrerequisites) !==
                                    JSON.stringify(afterPrerequisites)
                                )
                                    changedFields.push("prerequisites");
                                if (changedFields.length > 0)
                                    changes.push({
                                        entity: "CatalogCourse",
                                        operation: "update",
                                        key: {
                                            id: existing.id,
                                            catalogId: catalog.id,
                                            courseId: course.id
                                        },
                                        changedFields,
                                        before: Object.fromEntries(
                                            changedFields.map((field) => [
                                                field,
                                                field === "prerequisites"
                                                    ? beforePrerequisites
                                                    : existing[
                                                          field as keyof typeof existing
                                                      ]
                                            ])
                                        ),
                                        after: Object.fromEntries(
                                            changedFields.map((field) => [
                                                field,
                                                field === "prerequisites"
                                                    ? afterPrerequisites
                                                    : data[
                                                          field as keyof typeof data
                                                      ]
                                            ])
                                        )
                                    });
                                await tx.catalogCoursePrerequisiteGroup.deleteMany(
                                    {
                                        where: { catalogCourseId: persisted.id }
                                    }
                                );
                                for (const group of prerequisiteGroups)
                                    await tx.catalogCoursePrerequisiteGroup.create(
                                        {
                                            data: {
                                                catalogCourseId: persisted.id,
                                                items: { create: group.items }
                                            }
                                        }
                                    );
                            }
                            if (!existing)
                                changes.push({
                                    entity: "CatalogCourse",
                                    operation: "create",
                                    key: {
                                        id: persisted.id,
                                        catalogId: catalog.id,
                                        courseId: course.id
                                    },
                                    before: null,
                                    after: {
                                        ...data,
                                        prerequisites: prerequisiteGroups
                                    }
                                });
                            await tx.$executeRawUnsafe(
                                `RELEASE SAVEPOINT ${savepoint}`
                            );
                            imported += 1;
                        } catch (error) {
                            const savepoint = `catalog_discipline_${savepointCounter - 1}`;
                            try {
                                await tx.$executeRawUnsafe(
                                    `ROLLBACK TO SAVEPOINT ${savepoint}`
                                );
                                await tx.$executeRawUnsafe(
                                    `RELEASE SAVEPOINT ${savepoint}`
                                );
                            } catch (rollbackError) {
                                logger.error(
                                    {
                                        err: rollbackError,
                                        catalogYear: catalogInput.year,
                                        code
                                    },
                                    "Falha ao reverter disciplina"
                                );
                                throw error;
                            }
                            changes.splice(changeStart);
                            skipped += 1;
                            errors.push(error);
                            logger.warn(
                                {
                                    err: error,
                                    catalogYear: catalogInput.year,
                                    code
                                },
                                "Disciplina ignorada"
                            );
                        }
                    }
                }
                for (const code of existingCatalogCourses)
                    if (!seenCatalogCourses.has(code))
                        logger.warn(
                            { catalogYear: catalogInput.year, code },
                            "Disciplina ausente no novo resultado; registro mantido"
                        );
            }
            return {
                catalogs: catalogs.length,
                disciplines,
                imported,
                skipped
            };
        },
        { timeout: transactionTimeout, maxWait: transactionMaxWait }
    );

    for (const change of changes) logger.change(change);
    logger.info(
        { result, issues: errors.length },
        "Injeção de disciplinas concluída"
    );
    if (errors.length > 0)
        throw new Error(`Injeção concluída com ${errors.length} issue(s)`);
}
