/*
  Warnings:

  - You are about to drop the column `courseOfferingId` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the `CourseOffering` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `courseId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studyPeriodId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instituteId` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_courseOfferingId_fkey";

-- DropForeignKey
ALTER TABLE "CourseOffering" DROP CONSTRAINT "CourseOffering_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseOffering" DROP CONSTRAINT "CourseOffering_instituteId_fkey";

-- DropForeignKey
ALTER TABLE "CourseOffering" DROP CONSTRAINT "CourseOffering_studyPeriodId_fkey";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "courseOfferingId",
ADD COLUMN     "courseId" INTEGER NOT NULL,
ADD COLUMN     "studyPeriodId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "instituteId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "CourseOffering";

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_studyPeriodId_fkey" FOREIGN KEY ("studyPeriodId") REFERENCES "StudyPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
