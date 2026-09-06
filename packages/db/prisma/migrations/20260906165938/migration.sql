/*
  Warnings:

  - A unique constraint covering the columns `[canonicalKey]` on the table `data_portal_position` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_academic_role" AS ENUM ('PROFESSOR', 'RESEARCHER', 'POSTDOCTORAL_RESEARCHER');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_academic_affiliation_type" AS ENUM ('CAREER', 'COLLABORATOR', 'SENIOR', 'VISITING_INVITED', 'VISITING_SPECIALIST', 'POSTDOCTORAL_PROGRAM');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_academic_career" AS ENUM ('MS', 'MA', 'MTS', 'MST', 'DEL', 'DEER', 'PQ');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_academic_postdoctoral_modality" AS ENUM ('STANDARD', 'OM');

-- AlterTable
ALTER TABLE "unicamp_data_portal"."data_portal_position" ADD COLUMN     "affiliationType" "unicamp_data_portal"."data_portal_academic_affiliation_type",
ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "careerReferenceId" INTEGER,
ADD COLUMN     "postdoctoralModality" "unicamp_data_portal"."data_portal_academic_postdoctoral_modality",
ADD COLUMN     "programCode" TEXT,
ADD COLUMN     "role" "unicamp_data_portal"."data_portal_academic_role";

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_academic_career_reference" (
    "id" SERIAL NOT NULL,
    "career" "unicamp_data_portal"."data_portal_academic_career" NOT NULL,
    "code" TEXT NOT NULL,
    "rank" TEXT,
    "category" TEXT,
    "progressionOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "data_portal_academic_career_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_academic_career_reference_career_code_key" ON "unicamp_data_portal"."data_portal_academic_career_reference"("career", "code");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_position_canonicalKey_key" ON "unicamp_data_portal"."data_portal_position"("canonicalKey");

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_position" ADD CONSTRAINT "data_portal_position_careerReferenceId_fkey" FOREIGN KEY ("careerReferenceId") REFERENCES "unicamp_data_portal"."data_portal_academic_career_reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
