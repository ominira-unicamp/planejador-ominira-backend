-- CreateEnum
CREATE TYPE "app"."FeedbackReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- AlterEnum
ALTER TYPE "app"."StudentCapability" ADD VALUE 'STUDENT_FEEDBACK_READ';

-- AlterEnum
ALTER TYPE "app"."StudentCourseAttemptStatus" ADD VALUE 'APPROVED_BY_PROFICIENCY';

-- AlterTable
ALTER TABLE "app"."FeedbackReport" ADD COLUMN     "adminMessage" TEXT,
ADD COLUMN     "status" "app"."FeedbackReportStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "app"."FeedbackReport"("status", "createdAt");
