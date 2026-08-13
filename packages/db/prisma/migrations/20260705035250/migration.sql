ALTER TABLE "Institute" RENAME TO "Unit";

ALTER TABLE "Unit" RENAME CONSTRAINT "Institute_pkey" TO "Unit_pkey";
ALTER INDEX "Institute_code_key" RENAME TO "Unit_code_key";

ALTER SEQUENCE "Institute_id_seq" RENAME TO "Unit_id_seq";

ALTER TABLE "Prefixes" RENAME COLUMN "instituteId" TO "unitId";
ALTER TABLE "Course" RENAME COLUMN "instituteId" TO "unitId";
ALTER TABLE "Program" RENAME COLUMN "instituteId" TO "unitId";

ALTER TABLE "Prefixes" RENAME CONSTRAINT "Prefixes_instituteId_fkey" TO "Prefixes_unitId_fkey";
ALTER TABLE "Course" RENAME CONSTRAINT "Course_instituteId_fkey" TO "Course_unitId_fkey";
ALTER TABLE "Program" RENAME CONSTRAINT "Program_instituteId_fkey" TO "Program_unitId_fkey";