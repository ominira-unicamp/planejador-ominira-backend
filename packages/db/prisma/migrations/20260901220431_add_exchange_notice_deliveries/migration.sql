-- CreateEnum
CREATE TYPE "app"."ExchangeNoticeDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "app"."ExchangeNoticeDelivery" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "noticeId" INTEGER NOT NULL,
    "status" "app"."ExchangeNoticeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeNoticeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeNoticeDelivery_status_nextAttemptAt_idx" ON "app"."ExchangeNoticeDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeNoticeDelivery_studentId_noticeId_key" ON "app"."ExchangeNoticeDelivery"("studentId", "noticeId");

-- AddForeignKey
ALTER TABLE "app"."ExchangeNoticeDelivery" ADD CONSTRAINT "ExchangeNoticeDelivery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "app"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeNoticeDelivery" ADD CONSTRAINT "ExchangeNoticeDelivery_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "data"."ExchangeNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
