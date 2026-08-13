-- CreateEnum
CREATE TYPE "YearPeriods" AS ENUM ('SUMMER', 'FIRST_SEMESTER', 'WINTER', 'SECOND_SEMESTER');

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_catalogId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_modalityId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_programId_fkey";

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "programId" DROP NOT NULL,
ALTER COLUMN "modalityId" DROP NOT NULL,
ALTER COLUMN "catalogId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumCourse" (
    "curriculumId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "semester" INTEGER,

    CONSTRAINT "CurriculumCourse_pkey" PRIMARY KEY ("curriculumId","courseId")
);

-- CreateTable
CREATE TABLE "PeriodPlanning" (
    "id" SERIAL NOT NULL,
    "studyPeriodId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,

    CONSTRAINT "PeriodPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClassToPeriodPlanning" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClassToPeriodPlanning_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ClassToPeriodPlanning_B_index" ON "_ClassToPeriodPlanning"("B");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumCourse" ADD CONSTRAINT "CurriculumCourse_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumCourse" ADD CONSTRAINT "CurriculumCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_studyPeriodId_fkey" FOREIGN KEY ("studyPeriodId") REFERENCES "StudyPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodPlanning" ADD CONSTRAINT "PeriodPlanning_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToPeriodPlanning" ADD CONSTRAINT "_ClassToPeriodPlanning_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToPeriodPlanning" ADD CONSTRAINT "_ClassToPeriodPlanning_B_fkey" FOREIGN KEY ("B") REFERENCES "PeriodPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
