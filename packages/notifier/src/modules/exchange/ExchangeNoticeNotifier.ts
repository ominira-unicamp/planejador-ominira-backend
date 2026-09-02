import type { NotifierConfig } from "#/Config.js";
import type { PrismaClient } from "@pomi/db";
import { ExchangeNoticeDeliveryStatus } from "@pomi/db";
import { SignJWT } from "jose";
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
        const lock = await this.prisma.$queryRaw<
            ReadonlyArray<{ acquired: boolean }>
        >`SELECT pg_try_advisory_lock(${LOCK_ID}) AS acquired`;
        if (!lock[0]?.acquired) {
            this.logger.info(
                "Ciclo de notificações ignorado: lock já está ativo."
            );
            return;
        }
        try {
            await this.recoverExpiredProcessing();
            await this.createPendingDeliveries();
            await this.sendPendingDeliveries();
        } finally {
            await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
        }
    }

    private async recoverExpiredProcessing() {
        await this.prisma.exchangeNoticeDelivery.updateMany({
            where: {
                status: ExchangeNoticeDeliveryStatus.PROCESSING,
                processingAt: {
                    lt: new Date(Date.now() - PROCESSING_TIMEOUT_MS)
                }
            },
            data: {
                status: ExchangeNoticeDeliveryStatus.PENDING,
                processingAt: null
            }
        });
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
            if (matchingNoticeIds.length === 0) continue;
            await this.prisma.exchangeNoticeDelivery.createMany({
                data: matchingNoticeIds.map((noticeId) => ({
                    studentId: subscription.studentId,
                    noticeId
                })),
                skipDuplicates: true
            });
        }
    }

    private async sendPendingDeliveries() {
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
        for (const { studentId } of dueDeliveries)
            await this.sendStudentDigest(studentId);
    }

    private async sendStudentDigest(studentId: number) {
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
        if (!subscription?.enabled || !email) return;

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
        if (deliveries.length === 0) return;

        const ids = deliveries.map(({ id }) => id);
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
        if (claimed.count !== ids.length) return;

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
            this.logger.info(
                { studentId, count: ids.length },
                "Digest de editais enviado."
            );
        } catch (error) {
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
                { err: error, studentId },
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
