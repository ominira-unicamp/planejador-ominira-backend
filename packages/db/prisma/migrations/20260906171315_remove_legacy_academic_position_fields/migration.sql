/*
  Warnings:

  - You are about to drop the column `careerCode` on the `data_portal_position` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `data_portal_position` table. All the data in the column will be lost.
  - You are about to drop the column `rank` on the `data_portal_position` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "unicamp_data_portal"."data_portal_position_careerCode_rank_category_key";

-- AlterTable
ALTER TABLE "unicamp_data_portal"."data_portal_position" DROP COLUMN "careerCode",
DROP COLUMN "category",
DROP COLUMN "rank";

-- DropEnum
DROP TYPE "unicamp_data_portal"."data_portal_career_code";

-- DropEnum
DROP TYPE "unicamp_data_portal"."data_portal_position_category";

-- DropEnum
DROP TYPE "unicamp_data_portal"."data_portal_professor_rank";
