-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_unitId_fkey";

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "unitId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
