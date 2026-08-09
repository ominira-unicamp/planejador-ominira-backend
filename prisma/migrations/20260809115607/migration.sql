/*
  Warnings:

  - A unique constraint covering the columns `[catalogSpecializationId]` on the table `CurriculumSuggestion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CurriculumSuggestionType" AS ENUM ('GENERAL', 'SPECIALIZATION', 'PRE_OPTION');

-- AlterTable
ALTER TABLE "CurriculumSuggestion" ADD COLUMN     "catalogSpecializationId" INTEGER,
ADD COLUMN     "type" "CurriculumSuggestionType" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSuggestion_catalogSpecializationId_key" ON "CurriculumSuggestion"("catalogSpecializationId");

-- AddForeignKey
ALTER TABLE "CurriculumSuggestion" ADD CONSTRAINT "CurriculumSuggestion_catalogSpecializationId_fkey" FOREIGN KEY ("catalogSpecializationId") REFERENCES "CatalogSpecialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
