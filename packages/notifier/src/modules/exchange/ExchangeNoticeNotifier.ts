import type { NotifierConfig } from "#/Config.js";
import { setActiveTraceAttributes, withTrace } from "@pomi/api-core";
import type { PrismaClient } from "@pomi/db";
import { ExchangeNoticeDeliveryStatus } from "@pomi/db";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Logger } from "pino";

const LOCK_ID = 724_401_816;
const PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

type Notice = {
    id: number;
    number: string | null;
    issuer: string | null;
    title: string | null;
    registrationEnd: Date | null;
    place: { name: string } | null;
};

export class ExchangeNoticeNotifier {
    private readonly transporter;

    constructor(
        private readonly prisma: PrismaClient,
        private readonly config: NotifierConfig,
        private readonly logger: Logger
    ) {
        this.transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpPort === 465,
            auth: { user: config.smtpUser, pass: config.smtpPass }
        });
    }

    async run(): Promise<void> {
        return withTrace("notifier.cycle", () => this.runCycle(), {
            attributes: {
                "notifier.interval_ms": this.config.intervalMs
            }
        })();
    }

    private async runCycle(): Promise<void> {
        const cycleId = randomUUID();
        const startedAt = Date.now();
        this.logger.info(
            {
                cycleId,
                intervalMs: this.config.intervalMs,
                maxAttempts: this.config.maxAttempts
            },
            "Ciclo de notificações iniciado."
        );
        let lockAcquired = false;
        try {
            const lock = await this.prisma.$queryRaw<
                ReadonlyArray<{ acquired: boolean }>
            >`SELECT pg_try_advisory_lock(${LOCK_ID}) AS acquired`;
            if (!lock[0]?.acquired) {
                this.logger.info(
                    { cycleId, lockId: LOCK_ID },
                    "Ciclo de notificações ignorado: lock já está ativo."
                );
                return;
            }
            lockAcquired = true;
            this.logger.debug(
                { cycleId, lockId: LOCK_ID },
                "Lock do ciclo de notificações adquirido."
            );
            const recovered = await this.recoverExpiredProcessing();
            this.logger.info(
                { cycleId, recovered },
                "Entregas em processamento recuperadas."
            );
            const created = await this.createPendingDeliveries();
            this.logger.info(
                { cycleId, ...created },
                "Entregas pendentes criadas."
            );
            const sent = await this.sendPendingDeliveries(cycleId);
            this.logger.info(
                { cycleId, ...sent, durationMs: Date.now() - startedAt },
                "Ciclo de notificações concluído."
            );
        } catch (error) {
            this.logger.error(
                {
                    err: error,
                    cycleId,
                    durationMs: Date.now() - startedAt
                },
                "Ciclo de notificações falhou durante o processamento."
            );
            throw error;
        } finally {
            if (lockAcquired) {
                await this.prisma
                    .$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
                this.logger.debug(
                    { cycleId, lockId: LOCK_ID },
                    "Lock do ciclo de notificações liberado."
                );
            }
        }
    }

    private async recoverExpiredProcessing() {
        const processingBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
        const result = await this.prisma.exchangeNoticeDelivery.updateMany({
            where: {
                status: ExchangeNoticeDeliveryStatus.PROCESSING,
                processingAt: {
                    lt: processingBefore
                }
            },
            data: {
                status: ExchangeNoticeDeliveryStatus.PENDING,
                processingAt: null
            }
        });
        return result.count;
    }

    private async createPendingDeliveries() {
        const now = new Date();
        const [notices, subscriptions] = await Promise.all([
            this.prisma.exchangeNotice.findMany({
                where: { registrationEnd: { gte: now } },
                include: { place: { select: { id: true, name: true } } }
            }),
            this.prisma.exchangeNoticeSubscription.findMany({
                where: { enabled: true },
                include: { places: { select: { placeId: true } } }
            })
        ]);
        let matchedDeliveries = 0;
        let createdDeliveries = 0;

        for (const subscription of subscriptions) {
            const placeIds = new Set(
                subscription.places.map(({ placeId }) => placeId)
            );
            const matchingNoticeIds = notices
                .filter(
                    (notice) =>
                        placeIds.size === 0 ||
                        (notice.placeId !== null &&
                            placeIds.has(notice.placeId))
                )
                .map((notice) => notice.id);
            matchedDeliveries += matchingNoticeIds.length;
            if (matchingNoticeIds.length === 0) {
                this.logger.debug(
                    {
                        studentId: subscription.studentId,
                        selectedPlaceCount: placeIds.size
                    },
                    "Assinatura sem editais correspondentes."
                );
                continue;
            }
            const result = await this.prisma.exchangeNoticeDelivery.createMany({
                data: matchingNoticeIds.map((noticeId) => ({
                    studentId: subscription.studentId,
                    noticeId
                })),
                skipDuplicates: true
            });
            createdDeliveries += result.count;
            this.logger.debug(
                {
                    studentId: subscription.studentId,
                    selectedPlaceCount: placeIds.size,
                    matchingNoticeCount: matchingNoticeIds.length,
                    createdDeliveryCount: result.count
                },
                "Entregas da assinatura processadas."
            );
        }
        return {
            noticeCount: notices.length,
            subscriptionCount: subscriptions.length,
            matchedDeliveries,
            createdDeliveries
        };
    }

    private async sendPendingDeliveries(cycleId: string) {
        const dueDeliveries = await this.prisma.exchangeNoticeDelivery.findMany(
            {
                where: {
                    status: {
                        in: [
                            ExchangeNoticeDeliveryStatus.PENDING,
                            ExchangeNoticeDeliveryStatus.FAILED
                        ]
                    },
                    nextAttemptAt: { lte: new Date() },
                    attemptCount: { lt: this.config.maxAttempts }
                },
                select: { studentId: true },
                distinct: ["studentId"]
            }
        );
        this.logger.info(
            { cycleId, studentCount: dueDeliveries.length },
            "Estudantes com digests vencidos encontrados."
        );
        let attemptedStudentCount = 0;
        for (const { studentId } of dueDeliveries) {
            attemptedStudentCount += 1;
            await this.sendStudentDigest(studentId, cycleId);
        }
        return { attemptedStudentCount };
    }

    private async sendStudentDigest(studentId: number, cycleId: string) {
        return withTrace("notifier.digest", () =>
            this.sendStudentDigestInternal(studentId, cycleId)
        )();
    }

    private async sendStudentDigestInternal(
        studentId: number,
        cycleId: string
    ) {
        const startedAt = Date.now();
        this.logger.debug(
            { cycleId, studentId },
            "Processamento de digest iniciado."
        );
        const now = new Date();
        const subscription =
            await this.prisma.exchangeNoticeSubscription.findUnique({
                where: { studentId },
                include: {
                    places: { select: { placeId: true } },
                    student: {
                        include: {
                            authUsers: {
                                where: {
                                    status: "ACTIVE",
                                    email: { not: null }
                                },
                                orderBy: { updatedAt: "desc" },
                                take: 1,
                                select: { email: true }
                            }
                        }
                    }
                }
            });
        const email = subscription?.student.authUsers[0]?.email;
        if (!subscription) {
            setActiveTraceAttributes({
                "notifier.digest.outcome": "subscription_missing"
            });
            this.logger.warn(
                { cycleId, studentId },
                "Digest ignorado: assinatura não encontrada."
            );
            return;
        }
        if (!subscription.enabled) {
            setActiveTraceAttributes({
                "notifier.digest.outcome": "subscription_disabled"
            });
            this.logger.info(
                { cycleId, studentId },
                "Digest ignorado: assinatura desabilitada."
            );
            return;
        }
        if (!email) {
            setActiveTraceAttributes({
                "notifier.digest.outcome": "recipient_unavailable"
            });
            this.logger.warn(
                {
                    cycleId,
                    studentId,
                    activeAuthUserCount: subscription.student.authUsers.length
                },
                "Digest ignorado: nenhum e-mail ativo encontrado."
            );
            return;
        }

        const placeIds = new Set(
            subscription.places.map(({ placeId }) => placeId)
        );
        const deliveries = await this.prisma.exchangeNoticeDelivery.findMany({
            where: {
                studentId,
                status: {
                    in: [
                        ExchangeNoticeDeliveryStatus.PENDING,
                        ExchangeNoticeDeliveryStatus.FAILED
                    ]
                },
                nextAttemptAt: { lte: now },
                attemptCount: { lt: this.config.maxAttempts },
                notice: {
                    registrationEnd: { gte: now },
                    ...(placeIds.size === 0
                        ? {}
                        : { placeId: { in: [...placeIds] } })
                }
            },
            include: { notice: { include: { place: true } } }
        });
        if (deliveries.length === 0) {
            setActiveTraceAttributes({
                "notifier.digest.outcome": "no_deliveries"
            });
            this.logger.debug(
                { cycleId, studentId, selectedPlaceCount: placeIds.size },
                "Digest ignorado: nenhuma entrega vencida após aplicar filtros."
            );
            return;
        }

        const ids = deliveries.map(({ id }) => id);
        setActiveTraceAttributes({
            "notifier.digest.delivery_count": deliveries.length
        });
        const claimed = await this.prisma.exchangeNoticeDelivery.updateMany({
            where: {
                id: { in: ids },
                status: {
                    in: [
                        ExchangeNoticeDeliveryStatus.PENDING,
                        ExchangeNoticeDeliveryStatus.FAILED
                    ]
                },
                nextAttemptAt: { lte: now }
            },
            data: {
                status: ExchangeNoticeDeliveryStatus.PROCESSING,
                processingAt: now,
                attemptCount: { increment: 1 }
            }
        });
        if (claimed.count !== ids.length) {
            setActiveTraceAttributes({
                "notifier.digest.outcome": "claim_conflict"
            });
            this.logger.warn(
                {
                    cycleId,
                    studentId,
                    deliveryCount: ids.length,
                    claimedDeliveryCount: claimed.count,
                    deliveryIds: ids
                },
                "Digest ignorado: as entregas não puderam ser reivindicadas integralmente."
            );
            return;
        }
        this.logger.debug(
            {
                cycleId,
                studentId,
                deliveryCount: ids.length,
                deliveryIds: ids,
                smtpHost: this.config.smtpHost,
                smtpPort: this.config.smtpPort
            },
            "Entregas reivindicadas; iniciando envio SMTP."
        );

        try {
            const message = await this.transporter.sendMail({
                from: this.config.smtpFrom,
                to: email,
                subject: `${deliveries.length} ${deliveries.length === 1 ? "novo edital" : "novos editais"} de intercâmbio`,
                text: await digestText(
                    deliveries.map(({ notice }) => notice),
                    await this.unsubscribeUrl(studentId),
                    new URL(
                        "/editais-de-intercambio",
                        this.config.frontendUrl
                    ).toString()
                ),
                headers: { Precedence: "bulk" }
            });
            const accepted = message.accepted.some(
                (address) =>
                    (typeof address === "string"
                        ? address
                        : address.address
                    ).toLowerCase() === email.toLowerCase()
            );
            if (!accepted) throw new Error(`SMTP did not accept ${email}`);
            await this.prisma.exchangeNoticeDelivery.updateMany({
                where: {
                    id: { in: ids },
                    status: ExchangeNoticeDeliveryStatus.PROCESSING
                },
                data: {
                    status: ExchangeNoticeDeliveryStatus.SENT,
                    sentAt: new Date(),
                    processingAt: null,
                    lastError: null
                }
            });
            setActiveTraceAttributes({ "notifier.digest.outcome": "sent" });
            this.logger.info(
                {
                    cycleId,
                    studentId,
                    count: ids.length,
                    deliveryIds: ids,
                    acceptedCount: message.accepted.length,
                    rejectedCount: message.rejected.length,
                    messageId: message.messageId,
                    durationMs: Date.now() - startedAt
                },
                "Digest de editais enviado."
            );
        } catch (error) {
            setActiveTraceAttributes({ "notifier.digest.outcome": "failed" });
            const attemptCount = deliveries[0]!.attemptCount + 1;
            const waitMs = Math.min(
                60 * 60 * 1000 * 24,
                60_000 * 2 ** attemptCount
            );
            await this.prisma.exchangeNoticeDelivery.updateMany({
                where: {
                    id: { in: ids },
                    status: ExchangeNoticeDeliveryStatus.PROCESSING
                },
                data: {
                    status: ExchangeNoticeDeliveryStatus.FAILED,
                    processingAt: null,
                    nextAttemptAt: new Date(Date.now() + waitMs),
                    lastError:
                        error instanceof Error
                            ? error.message
                            : "SMTP delivery failed"
                }
            });
            this.logger.error(
                {
                    err: error,
                    cycleId,
                    studentId,
                    deliveryCount: ids.length,
                    deliveryIds: ids,
                    attemptCount,
                    retryInMs: waitMs,
                    smtpHost: this.config.smtpHost,
                    smtpPort: this.config.smtpPort,
                    durationMs: Date.now() - startedAt
                },
                "Falha ao enviar digest de editais."
            );
        }
    }

    private async unsubscribeUrl(studentId: number) {
        const token = await new SignJWT({
            action: "exchange-notice-unsubscribe"
        })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(`${studentId}`)
            .setIssuedAt()
            .setExpirationTime("180d")
            .sign(new TextEncoder().encode(this.config.unsubscribeSecret));
        const url = new URL(
            "/exchange-notice-subscriptions/unsubscribe",
            this.config.appApiUrl
        );
        url.searchParams.set("token", token);
        return url.toString();
    }
}

async function digestText(
    notices: Notice[],
    unsubscribeUrl: string,
    preferencesUrl: string
) {
    return [
        "Olá!",
        "",
        "Novos editais de acordo com suas preferências:",
        "",
        ...notices.map((notice) =>
            [
                notice.number ?? "Sem número",
                notice.title ?? "Sem título",
                notice.place?.name,
                notice.registrationEnd &&
                    `até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(notice.registrationEnd)}`
            ]
                .filter(Boolean)
                .join(" • ")
        ),
        "",
        "---",
        "Para gerenciar suas preferências:",
        preferencesUrl,
        "",
        "Para cancelar estas notificações:",
        unsubscribeUrl,
        "",
        "Mensagem gerada automaticamente pelo POMI."
    ].join("\n");
}
