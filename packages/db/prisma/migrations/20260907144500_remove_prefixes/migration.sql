-- DropForeignKey
ALTER TABLE "data"."CatalogCoursePrerequisiteItem" DROP CONSTRAINT "CatalogCoursePrerequisiteItem_prefixId_fkey";

-- DropForeignKey
ALTER TABLE "data"."Course" DROP CONSTRAINT "Course_prefixId_fkey";

-- DropForeignKey
ALTER TABLE "data"."CourseRequirement" DROP CONSTRAINT "CourseRequirement_prefixId_fkey";

-- DropForeignKey
ALTER TABLE "data"."Prefixes" DROP CONSTRAINT "Prefixes_unitId_fkey";

-- DropIndex
DROP INDEX "data"."Course_prefixId_idx";

-- AlterTable
ALTER TABLE "data"."CatalogCoursePrerequisiteItem" DROP COLUMN "prefixId";

-- AlterTable
ALTER TABLE "data"."Course" DROP COLUMN "prefixId";

-- AlterTable
ALTER TABLE "data"."CourseRequirement" DROP COLUMN "prefixId";

-- DropTable
DROP TABLE "data"."Prefixes";
