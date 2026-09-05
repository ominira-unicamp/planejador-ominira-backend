/*
  Warnings:

  - A unique constraint covering the columns `[studentId,courseId,studyPeriodId]` on the table `StudentCourseAttempt` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "StudentCourseAttempt_studentId_courseId_studyPeriodId_key" ON "app"."StudentCourseAttempt"("studentId", "courseId", "studyPeriodId");
