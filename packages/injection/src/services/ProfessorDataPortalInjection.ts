import {
    findAcademicPositionDefinition,
    IdentifierSystem,
    TrainingDegree
} from "@pomi/db";
import { readFile } from "node:fs/promises";
import { withAuditTransaction } from "../audit-context.js";
import type { InjectionContext } from "./InjectionTypes.js";
import { unwrapScrapeData } from "./scrape-input.js";

type PortalRecord = {
    portalId: number;
    name: string;
    position?: string;
    unit?: { code?: string; name?: string };
    department?: string;
    email?: string;
    identifiers?: Array<{ system: string; externalId: string }>;
    citationNames?: string[];
    lattesAbstract?: string;
    latestTraining?: Array<{
        startYear?: number;
        endYear?: number;
        degree?: string;
        institution?: string;
    }>;
    keywords?: Array<{ name: string; count?: number }>;
    coauthors?: Array<{ name: string; count?: number }>;
};

type NamedCount = {
    normalizedName: string;
    name: string;
    count?: number;
};

type Training = {
    degree: TrainingDegree;
    institutionName: string;
    startYear?: number;
    endYear?: number;
};

type Candidate = {
    record: PortalRecord;
    progress: number;
    professorId: number;
    unitId: number;
    position?: ReturnType<typeof findAcademicPositionDefinition>;
    departmentName?: string;
    identifiers: Array<{ system: IdentifierSystem; externalId: string }>;
    citationNames: string[];
    trainings: Training[];
    keywords: NamedCount[];
    coauthors: NamedCount[];
};

type ExistingProfile = {
    id: number;
    professorId: number;
    portalId: number;
    name: string;
    email: string | null;
    lattesAbstract: string | null;
    unitId: number;
    departmentId: number | null;
    positionId: number | null;
    identities: Array<{ system: IdentifierSystem; externalId: string }>;
    citationNames: Array<{ name: string }>;
    trainings: Training[];
    keywords: Array<{
        count: number | null;
        keyword: { normalizedName: string };
    }>;
    coauthors: Array<{
        count: number | null;
        coauthor: { normalizedName: string };
    }>;
};

type ResolvedCandidate = Omit<Candidate, "keywords" | "coauthors"> & {
    departmentId?: number;
    positionId?: number;
    keywords: Array<{
        keywordId: number;
        normalizedName: string;
        count?: number;
    }>;
    coauthors: Array<{
        coauthorId: number;
        normalizedName: string;
        count?: number;
    }>;
    existing?: ExistingProfile;
};

export type ProfessorDataPortalInjectionOptions = {
    databaseConcurrency?: number;
    transactionTimeout?: number;
    transactionMaxWait?: number;
};

const identifierSystems = new Set(Object.values(IdentifierSystem));

export function normalizeLookupKey(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export const parsePosition = findAcademicPositionDefinition;

export function parseDegree(value: string | undefined) {
    const normalized = normalizeLookupKey(value ?? "");
    if (normalized.includes("pos") || normalized.includes("post"))
        return TrainingDegree.POST_DOCTORATE;
    if (normalized.includes("doutor")) return TrainingDegree.DOCTORATE;
    if (normalized.includes("mestr")) return TrainingDegree.MASTER;
    if (normalized.includes("gradu") || normalized.includes("bacharel"))
        return TrainingDegree.UNDERGRADUATE;
    return undefined;
}

function addIssue(context: InjectionContext, issue: unknown) {
    context.addIssue?.(issue);
}

function departmentKey(unitId: number, name: string) {
    return `${unitId}\u0000${name}`;
}

export function collectionEquals<T>(
    actual: T[],
    desired: T[],
    key: (value: T) => string
) {
    if (actual.length !== desired.length) return false;
    const counts = new Map<string, number>();
    for (const value of actual)
        counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
    for (const value of desired) {
        const valueKey = key(value);
        const count = counts.get(valueKey);
        if (!count) return false;
        if (count === 1) counts.delete(valueKey);
        else counts.set(valueKey, count - 1);
    }
    return counts.size === 0;
}

function normalizedNamedCounts(
    values: Array<{ name: string; count?: number }>
) {
    const normalized = new Map<string, NamedCount>();
    for (const value of values) {
        if (!value.name?.trim()) continue;
        const normalizedName = normalizeLookupKey(value.name);
        const previous = normalized.get(normalizedName);
        normalized.set(normalizedName, {
            normalizedName,
            name: previous?.name ?? value.name.trim(),
            count:
                previous?.count !== undefined && value.count !== undefined
                    ? previous.count + value.count
                    : (value.count ?? previous?.count)
        });
    }
    return [...normalized.values()];
}

function normalizeIdentifiers(record: PortalRecord, context: InjectionContext) {
    const identifiers = new Map<
        string,
        { system: IdentifierSystem; externalId: string }
    >();
    for (const identifier of record.identifiers ?? []) {
        const valid = identifierSystems.has(
            identifier.system as IdentifierSystem
        );
        if (!valid) {
            addIssue(context, {
                type: "identifier-invalid",
                portalId: record.portalId,
                identifier
            });
            continue;
        }
        const externalId = identifier.externalId.trim();
        if (!externalId) continue;
        identifiers.set(`${identifier.system}:${externalId}`, {
            system: identifier.system as IdentifierSystem,
            externalId
        });
    }
    return [...identifiers.values()];
}

function normalizeTrainings(record: PortalRecord, context: InjectionContext) {
    const trainings: Training[] = [];
    for (const training of record.latestTraining ?? []) {
        const degree = parseDegree(training.degree);
        if (!degree || !training.institution?.trim()) {
            addIssue(context, {
                type: "training-invalid",
                portalId: record.portalId,
                training
            });
            continue;
        }
        trainings.push({
            degree,
            institutionName: training.institution.trim(),
            startYear: training.startYear,
            endYear: training.endYear
        });
    }
    return trainings;
}

function profileScalarsChanged(
    existing: ExistingProfile | undefined,
    candidate: ResolvedCandidate
) {
    if (!existing) return true;
    if (
        existing.professorId !== candidate.professorId ||
        existing.name !== candidate.record.name ||
        existing.unitId !== candidate.unitId
    )
        return true;
    if (
        candidate.departmentId !== undefined &&
        existing.departmentId !== candidate.departmentId
    )
        return true;
    if (
        candidate.positionId !== undefined &&
        existing.positionId !== candidate.positionId
    )
        return true;
    if (
        candidate.record.email !== undefined &&
        existing.email !== candidate.record.email
    )
        return true;
    return (
        candidate.record.lattesAbstract !== undefined &&
        existing.lattesAbstract !== candidate.record.lattesAbstract
    );
}

function changedCollections(
    existing: ExistingProfile | undefined,
    candidate: ResolvedCandidate
) {
    if (!existing)
        return [
            "identities",
            "citationNames",
            "trainings",
            "keywords",
            "coauthors"
        ];
    const changes: string[] = [];
    if (
        !collectionEquals(
            existing.identities,
            candidate.identifiers,
            (value) => `${value.system}:${value.externalId}`
        )
    )
        changes.push("identities");
    if (
        !collectionEquals(
            existing.citationNames,
            candidate.citationNames.map((name) => ({ name })),
            (value) => value.name
        )
    )
        changes.push("citationNames");
    if (
        !collectionEquals(existing.trainings, candidate.trainings, (value) =>
            JSON.stringify([
                value.degree,
                value.institutionName,
                value.startYear ?? null,
                value.endYear ?? null
            ])
        )
    )
        changes.push("trainings");
    if (
        !collectionEquals(
            existing.keywords.map((keyword) => ({
                normalizedName: keyword.keyword.normalizedName,
                count: keyword.count ?? undefined
            })),
            candidate.keywords.map((keyword) => ({
                normalizedName: keyword.normalizedName,
                count: keyword.count ?? undefined
            })),
            (value) => `${value.normalizedName}:${value.count ?? null}`
        )
    )
        changes.push("keywords");
    if (
        !collectionEquals(
            existing.coauthors.map((coauthor) => ({
                normalizedName: coauthor.coauthor.normalizedName,
                count: coauthor.count ?? undefined
            })),
            candidate.coauthors.map((coauthor) => ({
                normalizedName: coauthor.normalizedName,
                count: coauthor.count ?? undefined
            })),
            (value) => `${value.normalizedName}:${value.count ?? null}`
        )
    )
        changes.push("coauthors");
    return changes;
}

export async function mapWithConcurrency<T>(
    values: T[],
    concurrency: number,
    operation: (value: T) => Promise<void>
) {
    let next = 0;
    let failure: unknown;
    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, values.length) },
            async () => {
                while (failure === undefined) {
                    const index = next;
                    next += 1;
                    if (index >= values.length) return;
                    try {
                        await operation(values[index]);
                    } catch (error) {
                        failure = error;
                        return;
                    }
                }
            }
        )
    );
    if (failure !== undefined) throw failure;
}

export async function injectProfessorDataPortal(
    context: InjectionContext,
    {
        databaseConcurrency = 4,
        transactionTimeout = 600_000,
        transactionMaxWait = 60_000
    }: ProfessorDataPortalInjectionOptions = {}
) {
    const { prisma, inputPath, logger, auditContext } = context;
    if (!Number.isInteger(databaseConcurrency) || databaseConcurrency < 1)
        throw new Error("databaseConcurrency deve ser um inteiro positivo");
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");
    const startedAt = Date.now();
    logger.info(
        {
            event: "injection.professors.started",
            inputPath,
            databaseConcurrency,
            transactionTimeout,
            transactionMaxWait
        },
        "Injeção de perfis do Portal iniciada"
    );
    const raw = JSON.parse(await readFile(inputPath, "utf8"));
    const data = unwrapScrapeData(raw);
    const records = (Array.isArray(data) ? data : [data]) as PortalRecord[];
    logger.info(
        {
            event: "injection.professors.input.loaded",
            profiles: records.length
        },
        "Arquivo de perfis carregado"
    );
    const [professors, units] = await Promise.all([
        prisma.professor.findMany({ select: { id: true, name: true } }),
        prisma.unit.findMany({ select: { id: true, code: true, name: true } })
    ]);
    const professorsByName = new Map<string, number[]>();
    for (const professor of professors) {
        const key = normalizeLookupKey(professor.name);
        professorsByName.set(key, [
            ...(professorsByName.get(key) ?? []),
            professor.id
        ]);
    }
    const unitsByCode = new Map(
        units.map((unit) => [normalizeLookupKey(unit.code), unit])
    );
    const unitsByName = new Map(
        units.map((unit) => [normalizeLookupKey(unit.name), unit])
    );
    let unmatched = 0;
    let skipped = 0;
    const candidates: Candidate[] = [];
    for (const [index, record] of records.entries()) {
        const progress = index + 1;
        const professorIds =
            professorsByName.get(normalizeLookupKey(record.name)) ?? [];
        if (professorIds.length === 0) {
            unmatched += 1;
            logger.debug(
                {
                    event: "injection.professor.unmatched",
                    portalId: record.portalId,
                    progress
                },
                "Professor não encontrado"
            );
            continue;
        }
        if (professorIds.length > 1) {
            skipped += 1;
            addIssue(context, {
                type: "professor-ambiguous",
                portalId: record.portalId,
                name: record.name,
                professorIds
            });
            continue;
        }
        const unit = record.unit?.code
            ? unitsByCode.get(normalizeLookupKey(record.unit.code))
            : record.unit?.name
              ? unitsByName.get(normalizeLookupKey(record.unit.name))
              : undefined;
        if (!unit) {
            skipped += 1;
            addIssue(context, {
                type: "unit-not-found",
                portalId: record.portalId,
                code: record.unit?.code,
                name: record.unit?.name
            });
            continue;
        }
        const position = parsePosition(record.position);
        if (!position && record.position?.trim()) {
            addIssue(context, {
                type: "position-unrecognized",
                portalId: record.portalId,
                position: record.position
            });
        }
        candidates.push({
            record,
            progress,
            professorId: professorIds[0],
            unitId: unit.id,
            position,
            departmentName: record.department?.trim() || undefined,
            identifiers: normalizeIdentifiers(record, context),
            citationNames: [...new Set(record.citationNames ?? [])],
            trainings: normalizeTrainings(record, context),
            keywords: normalizedNamedCounts(record.keywords ?? []),
            coauthors: normalizedNamedCounts(record.coauthors ?? [])
        });
    }
    logger.info(
        {
            event: "injection.professors.prepared",
            candidates: candidates.length,
            unmatched,
            skipped
        },
        "Perfis normalizados"
    );
    const existingProfiles = (await prisma.professorDataPortalProfile.findMany({
        where: {
            OR: [
                {
                    portalId: {
                        in: candidates.map(
                            (candidate) => candidate.record.portalId
                        )
                    }
                },
                {
                    professorId: {
                        in: candidates.map((candidate) => candidate.professorId)
                    }
                }
            ]
        },
        select: {
            id: true,
            professorId: true,
            portalId: true,
            name: true,
            email: true,
            lattesAbstract: true,
            unitId: true,
            departmentId: true,
            positionId: true,
            identities: { select: { system: true, externalId: true } },
            citationNames: { select: { name: true } },
            trainings: {
                select: {
                    degree: true,
                    institutionName: true,
                    startYear: true,
                    endYear: true
                }
            },
            keywords: {
                select: {
                    count: true,
                    keyword: { select: { normalizedName: true } }
                }
            },
            coauthors: {
                select: {
                    count: true,
                    coauthor: { select: { normalizedName: true } }
                }
            }
        }
    })) as ExistingProfile[];
    const existingByPortal = new Map(
        existingProfiles.map((profile) => [profile.portalId, profile])
    );
    const existingByProfessor = new Map(
        existingProfiles.map((profile) => [profile.professorId, profile])
    );
    const conflictFree = candidates.filter((candidate) => {
        const portalProfile = existingByPortal.get(candidate.record.portalId);
        const professorProfile = existingByProfessor.get(candidate.professorId);
        const conflict =
            (portalProfile &&
                portalProfile.professorId !== candidate.professorId) ||
            (professorProfile &&
                professorProfile.portalId !== candidate.record.portalId);
        if (!conflict) return true;
        skipped += 1;
        addIssue(context, {
            type: "professor-profile-conflict",
            portalId: candidate.record.portalId,
            existingProfessorId:
                portalProfile?.professorId ?? professorProfile?.professorId,
            matchedProfessorId: candidate.professorId
        });
        return false;
    });
    const departmentInputs = new Map<
        string,
        { unitId: number; name: string }
    >();
    const keywordInputs = new Map<string, NamedCount>();
    const coauthorInputs = new Map<string, NamedCount>();
    for (const candidate of conflictFree) {
        if (candidate.departmentName)
            departmentInputs.set(
                departmentKey(candidate.unitId, candidate.departmentName),
                { unitId: candidate.unitId, name: candidate.departmentName }
            );
        for (const keyword of candidate.keywords)
            keywordInputs.set(keyword.normalizedName, keyword);
        for (const coauthor of candidate.coauthors)
            coauthorInputs.set(coauthor.normalizedName, coauthor);
    }
    const existingDepartments = await prisma.department.findMany({
        where: { OR: [...departmentInputs.values()] },
        select: { id: true, unitId: true, name: true }
    });
    const departmentsByKey = new Map(
        existingDepartments.map((department) => [
            departmentKey(department.unitId, department.name),
            department.id
        ])
    );
    const positionKeys = [
        ...new Set(
            conflictFree.flatMap((candidate) =>
                candidate.position ? [candidate.position.canonicalKey] : []
            )
        )
    ];
    const positions = await prisma.academicPosition.findMany({
        where: { canonicalKey: { in: positionKeys } },
        select: { id: true, canonicalKey: true }
    });
    const positionsByKey = new Map(
        positions.map((position) => [position.canonicalKey, position.id])
    );
    const missingCatalogPositions = positionKeys.filter(
        (canonicalKey) => !positionsByKey.has(canonicalKey)
    );
    if (missingCatalogPositions.length)
        throw new Error(
            `Catálogo de posições acadêmicas não sincronizado: ${missingCatalogPositions.join(", ")}`
        );
    const [keywords, coauthors] = await Promise.all([
        prisma.keyword.findMany({
            where: { normalizedName: { in: [...keywordInputs.keys()] } },
            select: { id: true, normalizedName: true }
        }),
        prisma.coauthor.findMany({
            where: { normalizedName: { in: [...coauthorInputs.keys()] } },
            select: { id: true, normalizedName: true }
        })
    ]);
    const keywordsByName = new Map(
        keywords.map((keyword) => [keyword.normalizedName, keyword.id])
    );
    const coauthorsByName = new Map(
        coauthors.map((coauthor) => [coauthor.normalizedName, coauthor.id])
    );
    const missingDepartments = [...departmentInputs.entries()]
        .filter(([key]) => !departmentsByKey.has(key))
        .map(([, value]) => value);
    const missingKeywords = [...keywordInputs.entries()]
        .filter(([key]) => !keywordsByName.has(key))
        .map(([, value]) => ({
            name: value.name,
            normalizedName: value.normalizedName
        }));
    const missingCoauthors = [...coauthorInputs.entries()]
        .filter(([key]) => !coauthorsByName.has(key))
        .map(([, value]) => ({
            name: value.name,
            normalizedName: value.normalizedName
        }));
    if (
        missingDepartments.length ||
        missingKeywords.length ||
        missingCoauthors.length
    ) {
        await withAuditTransaction(
            prisma,
            auditContext,
            async (transaction) => {
                if (missingDepartments.length)
                    await transaction.department.createMany({
                        data: missingDepartments,
                        skipDuplicates: true
                    });
                if (missingKeywords.length)
                    await transaction.keyword.createMany({
                        data: missingKeywords,
                        skipDuplicates: true
                    });
                if (missingCoauthors.length)
                    await transaction.coauthor.createMany({
                        data: missingCoauthors,
                        skipDuplicates: true
                    });
            },
            { timeout: transactionTimeout, maxWait: transactionMaxWait }
        );
        const [
            createdDepartments,
            createdPositions,
            createdKeywords,
            createdCoauthors
        ] = await Promise.all([
            prisma.department.findMany({
                where: { OR: missingDepartments },
                select: { id: true, unitId: true, name: true }
            }),
            prisma.academicPosition.findMany({
                where: { canonicalKey: { in: positionKeys } },
                select: { id: true, canonicalKey: true }
            }),
            prisma.keyword.findMany({
                where: {
                    normalizedName: {
                        in: missingKeywords.map((item) => item.normalizedName)
                    }
                },
                select: { id: true, normalizedName: true }
            }),
            prisma.coauthor.findMany({
                where: {
                    normalizedName: {
                        in: missingCoauthors.map((item) => item.normalizedName)
                    }
                },
                select: { id: true, normalizedName: true }
            })
        ]);
        for (const department of createdDepartments)
            departmentsByKey.set(
                departmentKey(department.unitId, department.name),
                department.id
            );
        for (const position of createdPositions)
            positionsByKey.set(position.canonicalKey, position.id);
        for (const keyword of createdKeywords)
            keywordsByName.set(keyword.normalizedName, keyword.id);
        for (const coauthor of createdCoauthors)
            coauthorsByName.set(coauthor.normalizedName, coauthor.id);
    }
    const resolved: ResolvedCandidate[] = conflictFree.map((candidate) => ({
        ...candidate,
        departmentId: candidate.departmentName
            ? departmentsByKey.get(
                  departmentKey(candidate.unitId, candidate.departmentName)
              )
            : undefined,
        positionId: candidate.position
            ? positionsByKey.get(candidate.position.canonicalKey)
            : undefined,
        keywords: candidate.keywords.map((keyword) => {
            const keywordId = keywordsByName.get(keyword.normalizedName);
            if (!keywordId)
                throw new Error(
                    `Keyword não encontrada: ${keyword.normalizedName}`
                );
            return {
                keywordId,
                normalizedName: keyword.normalizedName,
                count: keyword.count
            };
        }),
        coauthors: candidate.coauthors.map((coauthor) => {
            const coauthorId = coauthorsByName.get(coauthor.normalizedName);
            if (!coauthorId)
                throw new Error(
                    `Coautor não encontrado: ${coauthor.normalizedName}`
                );
            return {
                coauthorId,
                normalizedName: coauthor.normalizedName,
                count: coauthor.count
            };
        }),
        existing: existingByPortal.get(candidate.record.portalId)
    }));
    logger.info(
        {
            event: "injection.professors.references.prepared",
            profiles: resolved.length,
            departments: departmentInputs.size,
            positions: positionKeys.length,
            keywords: keywordInputs.size,
            coauthors: coauthorInputs.size,
            created: {
                departments: missingDepartments.length,
                positions: 0,
                keywords: missingKeywords.length,
                coauthors: missingCoauthors.length
            }
        },
        "Referências preparadas"
    );
    let persisted = 0;
    let unchanged = 0;
    let completed = skipped + unmatched;
    let lastProgressAt = Date.now();
    const reportProgress = (force = false) => {
        const now = Date.now();
        if (!force && completed % 25 !== 0 && now - lastProgressAt < 10_000)
            return;
        lastProgressAt = now;
        const elapsedMs = now - startedAt;
        logger.info(
            {
                event: "injection.professors.progress",
                completed,
                total: records.length,
                persisted,
                unchanged,
                skipped,
                unmatched,
                profilesPerSecond:
                    elapsedMs > 0
                        ? Number((completed / (elapsedMs / 1_000)).toFixed(2))
                        : 0
            },
            "Progresso da injeção de perfis"
        );
    };
    await mapWithConcurrency(
        resolved,
        databaseConcurrency,
        async (candidate) => {
            if (context.signal?.aborted)
                throw context.signal.reason ?? new Error("Injeção cancelada");
            const profileStartedAt = Date.now();
            const scalarChanged = profileScalarsChanged(
                candidate.existing,
                candidate
            );
            const collections = changedCollections(
                candidate.existing,
                candidate
            );
            if (!scalarChanged && collections.length === 0) {
                unchanged += 1;
                completed += 1;
                reportProgress();
                return;
            }
            await withAuditTransaction(
                prisma,
                auditContext,
                async (transaction) => {
                    const profile = candidate.existing
                        ? scalarChanged
                            ? await transaction.professorDataPortalProfile.update(
                                  {
                                      where: { id: candidate.existing.id },
                                      data: {
                                          professorId: candidate.professorId,
                                          name: candidate.record.name,
                                          ...(candidate.record.email !==
                                          undefined
                                              ? {
                                                    email: candidate.record
                                                        .email
                                                }
                                              : {}),
                                          ...(candidate.record
                                              .lattesAbstract !== undefined
                                              ? {
                                                    lattesAbstract:
                                                        candidate.record
                                                            .lattesAbstract
                                                }
                                              : {}),
                                          unitId: candidate.unitId,
                                          ...(candidate.departmentId !==
                                          undefined
                                              ? {
                                                    departmentId:
                                                        candidate.departmentId
                                                }
                                              : {}),
                                          ...(candidate.positionId !== undefined
                                              ? {
                                                    positionId:
                                                        candidate.positionId
                                                }
                                              : {})
                                      },
                                      select: { id: true }
                                  }
                              )
                            : { id: candidate.existing.id }
                        : await transaction.professorDataPortalProfile.create({
                              data: {
                                  professorId: candidate.professorId,
                                  portalId: candidate.record.portalId,
                                  name: candidate.record.name,
                                  email: candidate.record.email,
                                  lattesAbstract:
                                      candidate.record.lattesAbstract,
                                  unitId: candidate.unitId,
                                  departmentId: candidate.departmentId,
                                  positionId: candidate.positionId
                              },
                              select: { id: true }
                          });
                    if (collections.includes("identities")) {
                        await transaction.professorExternalIdentity.deleteMany({
                            where: { profileId: profile.id }
                        });
                        if (candidate.identifiers.length)
                            await transaction.professorExternalIdentity.createMany(
                                {
                                    data: candidate.identifiers.map(
                                        (identifier) => ({
                                            profileId: profile.id,
                                            ...identifier
                                        })
                                    )
                                }
                            );
                    }
                    if (collections.includes("citationNames")) {
                        await transaction.professorCitationName.deleteMany({
                            where: { profileId: profile.id }
                        });
                        if (candidate.citationNames.length)
                            await transaction.professorCitationName.createMany({
                                data: candidate.citationNames.map((name) => ({
                                    profileId: profile.id,
                                    name
                                }))
                            });
                    }
                    if (collections.includes("trainings")) {
                        await transaction.professorTraining.deleteMany({
                            where: { profileId: profile.id }
                        });
                        if (candidate.trainings.length)
                            await transaction.professorTraining.createMany({
                                data: candidate.trainings.map((training) => ({
                                    profileId: profile.id,
                                    ...training
                                }))
                            });
                    }
                    if (collections.includes("keywords")) {
                        await transaction.professorKeyword.deleteMany({
                            where: { profileId: profile.id }
                        });
                        if (candidate.keywords.length)
                            await transaction.professorKeyword.createMany({
                                data: candidate.keywords.map(
                                    ({ keywordId, count }) => ({
                                        profileId: profile.id,
                                        keywordId,
                                        count
                                    })
                                )
                            });
                    }
                    if (collections.includes("coauthors")) {
                        await transaction.professorCoauthor.deleteMany({
                            where: { profileId: profile.id }
                        });
                        if (candidate.coauthors.length)
                            await transaction.professorCoauthor.createMany({
                                data: candidate.coauthors.map(
                                    ({ coauthorId, count }) => ({
                                        profileId: profile.id,
                                        coauthorId,
                                        count
                                    })
                                )
                            });
                    }
                },
                { timeout: transactionTimeout, maxWait: transactionMaxWait }
            );
            persisted += 1;
            completed += 1;
            logger.debug(
                {
                    event: "injection.professor.completed",
                    portalId: candidate.record.portalId,
                    progress: candidate.progress,
                    changedScalars: scalarChanged,
                    changedCollections: collections,
                    durationMs: Date.now() - profileStartedAt
                },
                "Perfil persistido"
            );
            reportProgress();
        }
    );
    reportProgress(true);
    logger.info(
        {
            event: "injection.professors.completed",
            profiles: records.length,
            persisted,
            unchanged,
            unmatched,
            skipped,
            durationMs: Date.now() - startedAt
        },
        "Injeção de perfis do Portal concluída"
    );
}
