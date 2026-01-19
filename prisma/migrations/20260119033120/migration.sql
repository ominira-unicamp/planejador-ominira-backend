/*
  Warnings:

  - The primary key for the `StudentCourse` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `StudentCourse` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[catalogProgramId,languageId]` on the table `CatalogLanguage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CatalogLanguage" DROP CONSTRAINT "CatalogLanguage_catalogProgramId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogLanguage" DROP CONSTRAINT "CatalogLanguage_languageId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogSpecialization" DROP CONSTRAINT "CatalogSpecialization_catalogProgramId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogSpecialization" DROP CONSTRAINT "CatalogSpecialization_specializationId_fkey";

-- DropForeignKey
ALTER TABLE "CourseBlock" DROP CONSTRAINT "CourseBlock_catalogLanguageId_fkey";

-- DropForeignKey
ALTER TABLE "CourseBlock" DROP CONSTRAINT "CourseBlock_catalogProgramId_fkey";

-- DropForeignKey
ALTER TABLE "CourseBlock" DROP CONSTRAINT "CourseBlock_catalogSpecializationId_fkey";

-- DropForeignKey
ALTER TABLE "CourseRequirement" DROP CONSTRAINT "CourseRequirement_courseBlockId_fkey";

-- DropIndex
DROP INDEX "StudentCourse_studentId_courseId_key";

-- AlterTable
ALTER TABLE "StudentCourse" DROP CONSTRAINT "StudentCourse_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "StudentCourse_pkey" PRIMARY KEY ("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogLanguage_catalogProgramId_languageId_key" ON "CatalogLanguage"("catalogProgramId", "languageId");

-- AddForeignKey
ALTER TABLE "CatalogSpecialization" ADD CONSTRAINT "CatalogSpecialization_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSpecialization" ADD CONSTRAINT "CatalogSpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogLanguage" ADD CONSTRAINT "CatalogLanguage_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogLanguage" ADD CONSTRAINT "CatalogLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogLanguageId_fkey" FOREIGN KEY ("catalogLanguageId") REFERENCES "CatalogLanguage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogSpecializationId_fkey" FOREIGN KEY ("catalogSpecializationId") REFERENCES "CatalogSpecialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseBlockId_fkey" FOREIGN KEY ("courseBlockId") REFERENCES "CourseBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
