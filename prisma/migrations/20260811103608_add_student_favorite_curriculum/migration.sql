/*
  Warnings:

  - A unique constraint covering the columns `[favoriteCurriculumId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "favoriteCurriculumId" INTEGER;

-- AlterTable
ALTER TABLE "StudentCourseAttempt" ADD COLUMN     "classId" INTEGER;

-- CreateIndex
CREATE INDEX "PeriodPlanning_curriculumSuggestionId_idx" ON "PeriodPlanning"("curriculumSuggestionId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_catalogProgramId_idx" ON "PeriodPlanning"("catalogProgramId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_specializationId_idx" ON "PeriodPlanning"("specializationId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_languageId_idx" ON "PeriodPlanning"("languageId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_favoriteCurriculumId_key" ON "Student"("favoriteCurriculumId");

-- CreateIndex
CREATE INDEX "StudentCourseAttempt_classId_idx" ON "StudentCourseAttempt"("classId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_favoriteCurriculumId_fkey" FOREIGN KEY ("favoriteCurriculumId") REFERENCES "Curriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCourseAttempt" ADD CONSTRAINT "StudentCourseAttempt_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
