/*
  Warnings:

  - You are about to alter the column `grade` on the `StudentCourseAttempt` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.

*/
-- DropIndex
DROP INDEX "PeriodPlanning_catalogProgramId_idx";

-- DropIndex
DROP INDEX "PeriodPlanning_curriculumSuggestionId_idx";

-- DropIndex
DROP INDEX "PeriodPlanning_languageId_idx";

-- DropIndex
DROP INDEX "PeriodPlanning_specializationId_idx";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "entryYear" INTEGER,
ADD COLUMN     "languageId" INTEGER;

-- AlterTable
ALTER TABLE "StudentCourseAttempt" ALTER COLUMN "grade" SET DATA TYPE DECIMAL(65,30);

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;
