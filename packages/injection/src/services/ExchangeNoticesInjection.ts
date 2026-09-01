import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { InjectionContext } from "./InjectionTypes.js";

const fileSchema = z.object({ name: z.string(), url: z.string() });

const noticeSchema = z.object({
    number: z.string().nullable(),
    issuer: z.string().nullable(),
    title: z.string().nullable(),
    place: z.string().min(1),
    registration: z
        .object({
            originalText: z.string(),
            startsAt: z.string().date().nullable().optional(),
            endsAt: z.string().date().nullable().optional()
        })
        .nullable(),
    files: z.array(fileSchema)
});

const inputSchema = z.object({
    data: z.array(noticeSchema),
    issues: z.array(z.unknown()).default([]),
    pages: z.array(z.unknown()).default([])
});

type ExchangeNoticeInput = z.infer<typeof noticeSchema>;

export type ExchangeNoticesInjectionOptions = {
    transactionTimeout?: number;
    transactionMaxWait?: number;
};

function normalize(value: string) {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleUpperCase("pt-BR");
}

function optionalNormalized(value: string | null) {
    return value ? normalize(value) : "";
}

export function exchangeNoticeNaturalKey(notice: ExchangeNoticeInput) {
    const parts = [notice.number, notice.issuer, notice.title].map(
        optionalNormalized
    );
    if (parts.every((part) => !part)) return null;
    return parts.join("|");
}

function comparableNotice(notice: ExchangeNoticeInput, placeId: number) {
    return {
        number: notice.number?.trim() || null,
        issuer: notice.issuer?.trim() || null,
        title: notice.title?.trim() || null,
        placeId,
        registrationOriginalText:
            notice.registration?.originalText.trim() || null,
        registrationStart: notice.registration?.startsAt
            ? new Date(`${notice.registration.startsAt}T00:00:00.000Z`)
            : null,
        registrationEnd: notice.registration?.endsAt
            ? new Date(`${notice.registration.endsAt}T00:00:00.000Z`)
            : null
    };
}

function sameDate(left: Date | null, right: Date | null) {
    return left?.getTime() === right?.getTime();
}

function hasNoticeChanged(
    previous: {
        number: string | null;
        issuer: string | null;
        title: string | null;
        placeId: number | null;
        registrationOriginalText: string | null;
        registrationStart: Date | null;
        registrationEnd: Date | null;
    },
    next: ReturnType<typeof comparableNotice>
) {
    return (
        previous.number !== next.number ||
        previous.issuer !== next.issuer ||
        previous.title !== next.title ||
        previous.placeId !== next.placeId ||
        previous.registrationOriginalText !== next.registrationOriginalText ||
        !sameDate(previous.registrationStart, next.registrationStart) ||
        !sameDate(previous.registrationEnd, next.registrationEnd)
    );
}

export async function injectExchangeNotices(
    context: InjectionContext,
    {
        transactionTimeout = 60_000,
        transactionMaxWait = 10_000
    }: ExchangeNoticesInjectionOptions = {}
) {
    if (!Number.isInteger(transactionTimeout) || transactionTimeout < 1)
        throw new Error("transactionTimeout deve ser um inteiro positivo");
    if (!Number.isInteger(transactionMaxWait) || transactionMaxWait < 1)
        throw new Error("transactionMaxWait deve ser um inteiro positivo");

    const input = inputSchema.parse(
        JSON.parse(await readFile(context.inputPath, "utf8"))
    );
    for (const issue of input.issues)
        context.logger.warn({ issue }, "Issue recebida do scrapper");

    const notices = input.data.flatMap((notice) => {
        const naturalKey = exchangeNoticeNaturalKey(notice);
        if (naturalKey) return [{ notice, naturalKey }];
        context.logger.warn(
            { notice },
            "Edital sem identificadores suficientes; edital ignorado"
        );
        return [];
    });
    const duplicateKeys = new Set<string>();
    const uniqueNotices = notices.filter(({ naturalKey }) => {
        if (duplicateKeys.has(naturalKey)) {
            context.logger.warn(
                { naturalKey },
                "Edital duplicado no resultado do scrapper; edital ignorado"
            );
            return false;
        }
        duplicateKeys.add(naturalKey);
        return true;
    });

    const existing = await context.prisma.exchangeNotice.findMany({
        include: { files: true }
    });
    const existingByNaturalKey = new Map(
        existing.map((notice) => [notice.naturalKey, notice])
    );
    const places = await context.prisma.exchangePlace.findMany();
    const placesByNormalizedName = new Map(
        places.map((place) => [place.normalizedName, place])
    );

    let changesCount = 0;
    const persistenceErrors: unknown[] = [];
    for (const { notice, naturalKey } of uniqueNotices) {
        if (context.signal?.aborted)
            throw context.signal.reason ?? new Error("Injection cancelada");
        try {
            const changes = await context.prisma.$transaction(
                async (tx) => {
                    const placeName = notice.place.trim();
                    const normalizedPlaceName = normalize(placeName);
                    let place = placesByNormalizedName.get(normalizedPlaceName);
                    const localChanges: Parameters<
                        InjectionContext["logger"]["change"]
                    >[0][] = [];
                    if (!place) {
                        place = await tx.exchangePlace.create({
                            data: {
                                name: placeName,
                                normalizedName: normalizedPlaceName
                            }
                        });
                        placesByNormalizedName.set(normalizedPlaceName, place);
                        localChanges.push({
                            entity: "ExchangePlace",
                            operation: "create",
                            key: {
                                id: place.id,
                                normalizedName: normalizedPlaceName
                            },
                            before: null,
                            after: { name: place.name }
                        });
                    }

                    const next = comparableNotice(notice, place.id);
                    const previous = existingByNaturalKey.get(naturalKey);
                    const persistedNotice = previous
                        ? previous
                        : await tx.exchangeNotice.create({
                              data: { naturalKey, ...next },
                              include: { files: true }
                          });
                    if (!previous) {
                        localChanges.push({
                            entity: "ExchangeNotice",
                            operation: "create",
                            key: { id: persistedNotice.id, naturalKey },
                            before: null,
                            after: next
                        });
                    } else if (hasNoticeChanged(previous, next)) {
                        await tx.exchangeNotice.update({
                            where: { id: previous.id },
                            data: next
                        });
                        localChanges.push({
                            entity: "ExchangeNotice",
                            operation: "update",
                            key: { id: previous.id, naturalKey },
                            before: comparableNotice(
                                {
                                    number: previous.number,
                                    issuer: previous.issuer,
                                    title: previous.title,
                                    place: "",
                                    registration:
                                        previous.registrationOriginalText
                                            ? {
                                                  originalText:
                                                      previous.registrationOriginalText,
                                                  startsAt:
                                                      previous.registrationStart
                                                          ?.toISOString()
                                                          .slice(0, 10) ?? null,
                                                  endsAt:
                                                      previous.registrationEnd
                                                          ?.toISOString()
                                                          .slice(0, 10) ?? null
                                              }
                                            : null,
                                    files: []
                                },
                                previous.placeId ?? place.id
                            ),
                            after: next
                        });
                    }

                    const filesByNormalizedName = new Map(
                        persistedNotice.files.map((file) => [
                            file.normalizedName,
                            file
                        ])
                    );
                    const seenFileNames = new Set<string>();
                    for (const file of notice.files) {
                        const name = file.name.trim() || "Link";
                        const normalizedName = normalize(name);
                        seenFileNames.add(normalizedName);
                        const url = file.url.trim() || null;
                        const persistedFile =
                            filesByNormalizedName.get(normalizedName);
                        if (!persistedFile) {
                            const created = await tx.exchangeNoticeFile.create({
                                data: {
                                    noticeId: persistedNotice.id,
                                    name,
                                    normalizedName,
                                    url
                                }
                            });
                            localChanges.push({
                                entity: "ExchangeNoticeFile",
                                operation: "create",
                                key: {
                                    id: created.id,
                                    noticeId: persistedNotice.id
                                },
                                before: null,
                                after: { name, url }
                            });
                        } else if (
                            persistedFile.name !== name ||
                            persistedFile.url !== url
                        ) {
                            await tx.exchangeNoticeFile.update({
                                where: { id: persistedFile.id },
                                data: { name, url }
                            });
                            localChanges.push({
                                entity: "ExchangeNoticeFile",
                                operation: "update",
                                key: {
                                    id: persistedFile.id,
                                    noticeId: persistedNotice.id
                                },
                                before: {
                                    name: persistedFile.name,
                                    url: persistedFile.url
                                },
                                after: { name, url }
                            });
                        }
                    }
                    const missingFiles = persistedNotice.files.filter(
                        (file) => !seenFileNames.has(file.normalizedName)
                    );
                    if (missingFiles.length > 0) {
                        await tx.exchangeNoticeFile.deleteMany({
                            where: {
                                id: { in: missingFiles.map((file) => file.id) }
                            }
                        });
                        for (const file of missingFiles)
                            localChanges.push({
                                entity: "ExchangeNoticeFile",
                                operation: "delete",
                                key: {
                                    id: file.id,
                                    noticeId: persistedNotice.id
                                },
                                before: { name: file.name, url: file.url },
                                after: null
                            });
                    }
                    return localChanges;
                },
                { timeout: transactionTimeout, maxWait: transactionMaxWait }
            );
            for (const change of changes) context.logger.change(change);
            changesCount += changes.length;
        } catch (error) {
            persistenceErrors.push(error);
            context.logger.warn(
                { err: error, naturalKey },
                "Edital de intercâmbio ignorado"
            );
        }
    }
    context.logger.info(
        {
            notices: uniqueNotices.length,
            changes: changesCount,
            sourceIssues: input.issues.length,
            persistenceIssues: persistenceErrors.length
        },
        "Injeção de editais de intercâmbio concluída"
    );
    if (persistenceErrors.length > 0)
        throw new AggregateError(
            persistenceErrors,
            `Falha em ${persistenceErrors.length} edital(is) de intercâmbio`
        );
}
