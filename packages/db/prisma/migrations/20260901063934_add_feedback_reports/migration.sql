-- CreateEnum
CREATE TYPE "app"."FeedbackReportKind" AS ENUM ('BUG', 'SUGGESTION', 'DATA_ISSUE');

-- CreateEnum
CREATE TYPE "app"."FeedbackReportTargetType" AS ENUM ('GENERAL', 'FEATURE', 'ACADEMIC_RESOURCE');

-- AlterEnum
ALTER TYPE "app"."StudentCapability" ADD VALUE 'STUDENT_FEEDBACK_WRITE';

-- CreateTable
CREATE TABLE "app"."FeedbackReport" (
    "id" SERIAL NOT NULL,
    "kind" "app"."FeedbackReportKind" NOT NULL,
    "targetType" "app"."FeedbackReportTargetType" NOT NULL,
    "featureKey" VARCHAR(64),
    "academicResourceType" VARCHAR(64),
    "academicResourceId" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "sourcePath" VARCHAR(300),
    "reporterStudentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackReport_createdAt_idx" ON "app"."FeedbackReport"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_reporterStudentId_idx" ON "app"."FeedbackReport"("reporterStudentId");

-- CreateIndex
CREATE INDEX "FeedbackReport_academicResourceType_academicResourceId_idx" ON "app"."FeedbackReport"("academicResourceType", "academicResourceId");

-- AddForeignKey
ALTER TABLE "app"."FeedbackReport" ADD CONSTRAINT "FeedbackReport_reporterStudentId_fkey" FOREIGN KEY ("reporterStudentId") REFERENCES "app"."Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
