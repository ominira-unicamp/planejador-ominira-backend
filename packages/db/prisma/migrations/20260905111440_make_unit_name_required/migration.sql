/*
  Warnings:

  - Made the column `name` on table `Unit` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "data"."Unit" ALTER COLUMN "name" SET NOT NULL;
