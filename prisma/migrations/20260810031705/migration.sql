/*
  Warnings:

  - Added the required column `updatedAt` to the `PeriodPlanning` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Curriculum" DROP CONSTRAINT "Curriculum_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumCourse" DROP CONSTRAINT "CurriculumCourse_curriculumId_fkey";

-- AlterTable
ALTER TABLE "Curriculum" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CurriculumPeriod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PeriodPlanning" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "curriculumId" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Novo planejamento de semestre',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "PeriodPlanning_studentId_updatedAt_idx" ON "PeriodPlanning"("studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "PeriodPlanning_curriculumId_idx" ON "PeriodPlanning"("curriculumId");

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumCourse" ADD CONSTRAINT "CurriculumCourse_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
