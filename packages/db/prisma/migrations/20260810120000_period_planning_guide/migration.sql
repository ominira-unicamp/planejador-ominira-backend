-- CreateEnum
CREATE TYPE "PeriodPlanningGuideMode" AS ENUM ('CURRICULUM', 'PROGRAM', 'NONE');

-- CreateEnum
CREATE TYPE "PeriodPlanningCurriculumSource" AS ENUM ('SAVED', 'SUGGESTION');

-- AlterTable
ALTER TABLE "PeriodPlanning"
    ADD COLUMN "guideMode" "PeriodPlanningGuideMode" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "curriculumSource" "PeriodPlanningCurriculumSource",
    ADD COLUMN "curriculumSuggestionId" INTEGER,
    ADD COLUMN "catalogProgramId" INTEGER,
    ADD COLUMN "specializationId" INTEGER,
    ADD COLUMN "languageId" INTEGER;

-- CreateTable
CREATE TABLE "PeriodPlanningManualCourse" (
    "periodPlanningId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodPlanningManualCourse_pkey" PRIMARY KEY ("periodPlanningId", "courseId")
);

-- CreateIndex
CREATE INDEX "PeriodPlanningManualCourse_courseId_idx" ON "PeriodPlanningManualCourse"("courseId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_curriculumSuggestionId_idx" ON "PeriodPlanning"("curriculumSuggestionId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_catalogProgramId_idx" ON "PeriodPlanning"("catalogProgramId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_specializationId_idx" ON "PeriodPlanning"("specializationId");

-- CreateIndex
CREATE INDEX "PeriodPlanning_languageId_idx" ON "PeriodPlanning"("languageId");

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_curriculumSuggestionId_fkey" FOREIGN KEY ("curriculumSuggestionId") REFERENCES "CurriculumSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanningManualCourse" ADD CONSTRAINT "PeriodPlanningManualCourse_periodPlanningId_fkey" FOREIGN KEY ("periodPlanningId") REFERENCES "PeriodPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanningManualCourse" ADD CONSTRAINT "PeriodPlanningManualCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
