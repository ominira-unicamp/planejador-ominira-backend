/*
  Warnings:

  - Made the column `affiliationType` on table `data_portal_position` required. This step will fail if there are existing NULL values in that column.
  - Made the column `canonicalKey` on table `data_portal_position` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role` on table `data_portal_position` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "unicamp_data_portal"."data_portal_position" ALTER COLUMN "affiliationType" SET NOT NULL,
ALTER COLUMN "canonicalKey" SET NOT NULL,
ALTER COLUMN "role" SET NOT NULL;
