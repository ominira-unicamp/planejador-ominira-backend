-- CreateIndex
CREATE INDEX "Course_prefixId_idx" ON "data"."Course"("prefixId");

-- CreateIndex
CREATE INDEX "Course_unitId_idx" ON "data"."Course"("unitId");

-- CreateIndex
CREATE INDEX "CatalogCourse_courseId_idx" ON "data"."CatalogCourse"("courseId");

-- CreateIndex
CREATE INDEX "CourseRequirement_courseBlockId_idx" ON "data"."CourseRequirement"("courseBlockId");

-- CreateIndex
CREATE INDEX "Class_courseId_idx" ON "data"."Class"("courseId");

-- CreateIndex
CREATE INDEX "Class_studyPeriodId_idx" ON "data"."Class"("studyPeriodId");

-- CreateIndex
CREATE INDEX "ClassSchedule_classId_idx" ON "data"."ClassSchedule"("classId");

-- CreateIndex
CREATE INDEX "ClassSchedule_roomId_idx" ON "data"."ClassSchedule"("roomId");
