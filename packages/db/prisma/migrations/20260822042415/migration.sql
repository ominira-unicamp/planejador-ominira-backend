-- CreateTable
CREATE TABLE "ProfessorEvaluation" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "wouldTakeAgain" SMALLINT NOT NULL,
    "fairness" SMALLINT NOT NULL,
    "clarity" SMALLINT NOT NULL,
    "difficulty" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessorEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessorEvaluation_classId_professorId_idx" ON "ProfessorEvaluation"("classId", "professorId");

-- CreateIndex
CREATE INDEX "ProfessorEvaluation_professorId_idx" ON "ProfessorEvaluation"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorEvaluation_studentId_classId_professorId_key" ON "ProfessorEvaluation"("studentId", "classId", "professorId");

-- AddForeignKey
ALTER TABLE "ProfessorEvaluation" ADD CONSTRAINT "ProfessorEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEvaluation" ADD CONSTRAINT "ProfessorEvaluation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEvaluation" ADD CONSTRAINT "ProfessorEvaluation_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
