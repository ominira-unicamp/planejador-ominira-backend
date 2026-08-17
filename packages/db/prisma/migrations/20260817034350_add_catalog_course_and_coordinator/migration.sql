/*
  Warnings:

  - A unique constraint covering the columns `[year]` on the table `Catalog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CourseOfferingPeriod" AS ENUM ('ALL_PERIODS', 'SUMMER', 'FIRST_SEMESTER', 'WINTER', 'SECOND_SEMESTER', 'UNIT_DISCRETION');

-- CreateTable
CREATE TABLE "Coordinator" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Coordinator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCourse" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "coordinatorId" INTEGER,
    "theoreticalHours" INTEGER,
    "practicalHours" INTEGER,
    "laboratoryHours" INTEGER,
    "guidedActivityHours" INTEGER,
    "distanceHours" INTEGER,
    "guidedExtensionHours" INTEGER,
    "practicalExtensionHours" INTEGER,
    "weeks" INTEGER,
    "weeklyClassHours" INTEGER,
    "classroomHours" INTEGER,
    "offeringPeriod" "CourseOfferingPeriod",
    "evaluation" TEXT,
    "finalExam" BOOLEAN,
    "minimumAttendancePercent" INTEGER,
    "syllabus" TEXT,
    "bibliography" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "CatalogCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCoursePrerequisiteGroup" (
    "id" SERIAL NOT NULL,
    "catalogCourseId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CatalogCoursePrerequisiteGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCoursePrerequisiteItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "courseId" INTEGER,
    "prefixId" INTEGER,

    CONSTRAINT "CatalogCoursePrerequisiteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coordinator_name_key" ON "Coordinator"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCourse_catalogId_courseId_key" ON "CatalogCourse"("catalogId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCoursePrerequisiteGroup_catalogCourseId_position_key" ON "CatalogCoursePrerequisiteGroup"("catalogCourseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCoursePrerequisiteItem_groupId_position_key" ON "CatalogCoursePrerequisiteItem"("groupId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_year_key" ON "Catalog"("year");

-- AddForeignKey
ALTER TABLE "CatalogCourse" ADD CONSTRAINT "CatalogCourse_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCourse" ADD CONSTRAINT "CatalogCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCourse" ADD CONSTRAINT "CatalogCourse_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCoursePrerequisiteGroup" ADD CONSTRAINT "CatalogCoursePrerequisiteGroup_catalogCourseId_fkey" FOREIGN KEY ("catalogCourseId") REFERENCES "CatalogCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCoursePrerequisiteItem" ADD CONSTRAINT "CatalogCoursePrerequisiteItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CatalogCoursePrerequisiteGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCoursePrerequisiteItem" ADD CONSTRAINT "CatalogCoursePrerequisiteItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCoursePrerequisiteItem" ADD CONSTRAINT "CatalogCoursePrerequisiteItem_prefixId_fkey" FOREIGN KEY ("prefixId") REFERENCES "Prefixes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
