/*
  Warnings:

  - You are about to drop the column `showEntryYear` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `showProgram` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `showSpecialization` on the `Student` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "app"."StudentCurrentCoursesVisibility" AS ENUM ('PRIVATE', 'FRIENDS', 'PUBLIC');

-- AlterTable
ALTER TABLE "app"."Student" DROP COLUMN "showEntryYear",
DROP COLUMN "showProgram",
DROP COLUMN "showSpecialization",
ADD COLUMN     "currentCoursesVisibility" "app"."StudentCurrentCoursesVisibility" NOT NULL DEFAULT 'PRIVATE';
