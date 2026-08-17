/*
  Warnings:

  - The values [SUMMER,FIRST_SEMESTER,WINTER,SECOND_SEMESTER] on the enum `CourseOfferingPeriod` will be removed. If these variants are still used in the database, this will fail.
  - The `evaluation` column on the `CatalogCourse` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `position` on the `CatalogCoursePrerequisiteGroup` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `CatalogCoursePrerequisiteItem` table. All the data in the column will be lost.
  - Added the required column `kind` to the `CatalogCoursePrerequisiteItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CourseEvaluationMode" AS ENUM ('GRADE_AND_ATTENDANCE', 'CONCEPT', 'ATTENDANCE');

-- CreateEnum
CREATE TYPE "CatalogCoursePrerequisiteKind" AS ENUM ('FULL', 'PARTIAL', 'SPECIAL');

-- AlterEnum
BEGIN;
CREATE TYPE "CourseOfferingPeriod_new" AS ENUM ('ALL_PERIODS', 'ODD_PERIODS', 'EVEN_PERIODS', 'UNIT_DISCRETION');
ALTER TABLE "CatalogCourse" ALTER COLUMN "offeringPeriod" TYPE "CourseOfferingPeriod_new" USING ("offeringPeriod"::text::"CourseOfferingPeriod_new");
ALTER TYPE "CourseOfferingPeriod" RENAME TO "CourseOfferingPeriod_old";
ALTER TYPE "CourseOfferingPeriod_new" RENAME TO "CourseOfferingPeriod";
DROP TYPE "public"."CourseOfferingPeriod_old";
COMMIT;

-- DropIndex
DROP INDEX "CatalogCoursePrerequisiteGroup_catalogCourseId_position_key";

-- DropIndex
DROP INDEX "CatalogCoursePrerequisiteItem_groupId_position_key";

-- AlterTable
ALTER TABLE "CatalogCourse" DROP COLUMN "evaluation",
ADD COLUMN     "evaluation" "CourseEvaluationMode";

-- AlterTable
ALTER TABLE "CatalogCoursePrerequisiteGroup" DROP COLUMN "position";

-- AlterTable
ALTER TABLE "CatalogCoursePrerequisiteItem" DROP COLUMN "position",
ADD COLUMN     "kind" "CatalogCoursePrerequisiteKind" NOT NULL;
