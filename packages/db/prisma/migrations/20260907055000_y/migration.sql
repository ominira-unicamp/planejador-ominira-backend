/*
  Warnings:

  - A unique constraint covering the columns `[shareId]` on the table `PeriodPlanning` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "app"."PeriodPlanningVisibility" AS ENUM ('PRIVATE', 'FRIENDS', 'PUBLIC');

-- AlterTable
ALTER TABLE "app"."PeriodPlanning" ADD COLUMN     "shareId" TEXT NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "visibility" "app"."PeriodPlanningVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "app"."StudentTagInterest" (
    "studentId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTagInterest_pkey" PRIMARY KEY ("studentId","tagId")
);

-- CreateIndex
CREATE INDEX "StudentTagInterest_tagId_idx" ON "app"."StudentTagInterest"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodPlanning_shareId_key" ON "app"."PeriodPlanning"("shareId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_visibility_studyPeriodId_updatedAt_idx" ON "app"."PeriodPlanning"("visibility", "studyPeriodId", "updatedAt");

-- AddForeignKey
ALTER TABLE "app"."StudentTagInterest" ADD CONSTRAINT "StudentTagInterest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "app"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."StudentTagInterest" ADD CONSTRAINT "StudentTagInterest_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "app"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
