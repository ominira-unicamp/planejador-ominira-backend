/*
  Warnings:

  - You are about to drop the column `name` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Institute` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `StudyPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `StudyPeriod` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Institute` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `StudyPeriod` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Institute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `StudyPeriod` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Modality_code_key";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "name",
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Institute" DROP COLUMN "name",
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StudyPeriod" DROP COLUMN "endDate",
DROP COLUMN "name",
ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Institute_code_key" ON "Institute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPeriod_code_key" ON "StudyPeriod"("code");
