-- CreateTable
CREATE TABLE "CurriculumSuggestion" (
    "id" SERIAL NOT NULL,
    "catalogProgramId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CurriculumSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterSuggestion" (
    "id" SERIAL NOT NULL,
    "suggestionId" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "electiveCredits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SemesterSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionCourse" (
    "id" SERIAL NOT NULL,
    "semesterSuggestionId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SuggestionCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSuggestion_catalogProgramId_code_key" ON "CurriculumSuggestion"("catalogProgramId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterSuggestion_suggestionId_semester_key" ON "SemesterSuggestion"("suggestionId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionCourse_semesterSuggestionId_courseId_key" ON "SuggestionCourse"("semesterSuggestionId", "courseId");

-- AddForeignKey
ALTER TABLE "CurriculumSuggestion" ADD CONSTRAINT "CurriculumSuggestion_catalogProgramId_fkey" FOREIGN KEY ("catalogProgramId") REFERENCES "CatalogProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterSuggestion" ADD CONSTRAINT "SemesterSuggestion_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "CurriculumSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionCourse" ADD CONSTRAINT "SuggestionCourse_semesterSuggestionId_fkey" FOREIGN KEY ("semesterSuggestionId") REFERENCES "SemesterSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionCourse" ADD CONSTRAINT "SuggestionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
