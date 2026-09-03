-- CreateEnum
CREATE TYPE "app"."JobRequestType" AS ENUM ('INJECTION', 'NOTIFIER');

-- CreateEnum
CREATE TYPE "app"."JobRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app"."JobRequestTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateTable
CREATE TABLE "app"."JobRequest" (
    "id" TEXT NOT NULL,
    "type" "app"."JobRequestType" NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT,
    "status" "app"."JobRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "app"."JobRequestTrigger" NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3),
    "deduplicationKey" TEXT,
    "requestedBy" TEXT,
    "runId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRequest_deduplicationKey_key" ON "app"."JobRequest"("deduplicationKey");

-- CreateIndex
CREATE INDEX "JobRequest_type_status_availableAt_idx" ON "app"."JobRequest"("type", "status", "availableAt");

-- CreateIndex
CREATE INDEX "JobRequest_type_name_status_idx" ON "app"."JobRequest"("type", "name", "status");
