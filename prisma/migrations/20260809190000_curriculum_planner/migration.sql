ALTER TABLE "Curriculum"
    ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Novo planejamento',
    ADD COLUMN "catalogProgramId" INTEGER,
    ADD COLUMN "catalogSpecializationId" INTEGER,
    ADD COLUMN "catalogLanguageId" INTEGER,
    ADD COLUMN "planningStartYear" INTEGER,
    ADD COLUMN "planningStartSemester" INTEGER,
    ADD COLUMN "planningStartNumber" INTEGER,
    ADD COLUMN "currentPeriodId" INTEGER,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "CurriculumPeriod" (
    "id" SERIAL NOT NULL,
    "curriculumId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumPeriod_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CurriculumCourse" ADD COLUMN "periodId" INTEGER;

INSERT INTO "CurriculumPeriod" ("curriculumId", "position")
SELECT DISTINCT "curriculumId", "semester"
FROM "CurriculumCourse"
WHERE "semester" IS NOT NULL;

UPDATE "CurriculumCourse" AS course
SET "periodId" = period."id"
FROM "CurriculumPeriod" AS period
WHERE period."curriculumId" = course."curriculumId"
  AND period."position" = course."semester";

ALTER TABLE "CurriculumCourse" DROP COLUMN "semester";

CREATE UNIQUE INDEX "CurriculumPeriod_curriculumId_position_key"
    ON "CurriculumPeriod"("curriculumId", "position");
CREATE INDEX "CurriculumCourse_curriculumId_periodId_idx"
    ON "CurriculumCourse"("curriculumId", "periodId");
CREATE INDEX "Curriculum_studentId_updatedAt_idx"
    ON "Curriculum"("studentId", "updatedAt");

ALTER TABLE "Curriculum"
    ADD CONSTRAINT "Curriculum_catalogProgramId_fkey"
        FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Curriculum_catalogSpecializationId_fkey"
        FOREIGN KEY ("catalogSpecializationId") REFERENCES "CatalogSpecialization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Curriculum_catalogLanguageId_fkey"
        FOREIGN KEY ("catalogLanguageId") REFERENCES "CatalogLanguage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Curriculum_currentPeriodId_fkey"
        FOREIGN KEY ("currentPeriodId") REFERENCES "CurriculumPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CurriculumPeriod"
    ADD CONSTRAINT "CurriculumPeriod_curriculumId_fkey"
        FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumCourse"
    ADD CONSTRAINT "CurriculumCourse_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "CurriculumPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
