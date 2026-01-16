/*
  Warnings:

  - You are about to drop the column `modalityId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `Modality` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramModalityCourse` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[catalogId,programId]` on the table `CatalogProgram` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CourseBlockType" AS ENUM ('mandatory', 'elective');

-- CreateEnum
CREATE TYPE "CourseRequirementType" AS ENUM ('any', 'prefix', 'specific');

-- DropForeignKey
ALTER TABLE "ProgramModalityCourse" DROP CONSTRAINT "ProgramModalityCourse_courseId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramModalityCourse" DROP CONSTRAINT "ProgramModalityCourse_modalityId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramModalityCourse" DROP CONSTRAINT "ProgramModalityCourse_programId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_modalityId_fkey";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "prefixId" INTEGER;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "modalityId",
ADD COLUMN     "specializationId" INTEGER;

-- DropTable
DROP TABLE "Modality";

-- DropTable
DROP TABLE "ProgramModalityCourse";

-- CreateTable
CREATE TABLE "Specialization" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSpecialization" (
    "id" SERIAL NOT NULL,
    "catalogProgramId" INTEGER NOT NULL,
    "specializationId" INTEGER NOT NULL,

    CONSTRAINT "CatalogSpecialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogLanguage" (
    "id" SERIAL NOT NULL,
    "catalogProgramId" INTEGER NOT NULL,
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "CatalogLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBlock" (
    "id" SERIAL NOT NULL,
    "type" "CourseBlockType" NOT NULL,
    "credits" INTEGER,
    "catalogLanguageId" INTEGER,
    "catalogSpecializationId" INTEGER,
    "catalogProgramId" INTEGER,

    CONSTRAINT "CourseBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRequirement" (
    "id" SERIAL NOT NULL,
    "courseBlockId" INTEGER NOT NULL,
    "type" "CourseRequirementType" NOT NULL,
    "courseId" INTEGER,
    "prefixId" INTEGER,

    CONSTRAINT "CourseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSpecialization_catalogProgramId_specializationId_key" ON "CatalogSpecialization"("catalogProgramId", "specializationId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProgram_catalogId_programId_key" ON "CatalogProgram"("catalogId", "programId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_prefixId_fkey" FOREIGN KEY ("prefixId") REFERENCES "Prefixes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSpecialization" ADD CONSTRAINT "CatalogSpecialization_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSpecialization" ADD CONSTRAINT "CatalogSpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogLanguage" ADD CONSTRAINT "CatalogLanguage_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogLanguage" ADD CONSTRAINT "CatalogLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogLanguageId_fkey" FOREIGN KEY ("catalogLanguageId") REFERENCES "CatalogLanguage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogSpecializationId_fkey" FOREIGN KEY ("catalogSpecializationId") REFERENCES "CatalogSpecialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseBlockId_fkey" FOREIGN KEY ("courseBlockId") REFERENCES "CourseBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_prefixId_fkey" FOREIGN KEY ("prefixId") REFERENCES "Prefixes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
