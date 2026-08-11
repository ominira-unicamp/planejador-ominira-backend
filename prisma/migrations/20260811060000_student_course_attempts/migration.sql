CREATE TYPE "StudentCourseAttemptStatus" AS ENUM ('ENROLLED', 'COMPLETED', 'FAILED', 'DROPPED');

CREATE TABLE "StudentCourseAttempt" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "studyPeriodId" INTEGER,
    "status" "StudentCourseAttemptStatus" NOT NULL,
    "grade" DECIMAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCourseAttempt_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StudentCourseAttempt" ("studentId", "courseId", "status", "updatedAt")
SELECT "studentId", "courseId", "status"::text::"StudentCourseAttemptStatus", CURRENT_TIMESTAMP
FROM "StudentCourse";

CREATE INDEX "StudentCourseAttempt_studentId_studyPeriodId_idx" ON "StudentCourseAttempt"("studentId", "studyPeriodId");
CREATE INDEX "StudentCourseAttempt_studentId_courseId_idx" ON "StudentCourseAttempt"("studentId", "courseId");
CREATE INDEX "StudentCourseAttempt_studentId_status_idx" ON "StudentCourseAttempt"("studentId", "status");

ALTER TABLE "StudentCourseAttempt" ADD CONSTRAINT "StudentCourseAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentCourseAttempt" ADD CONSTRAINT "StudentCourseAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCourseAttempt" ADD CONSTRAINT "StudentCourseAttempt_studyPeriodId_fkey" FOREIGN KEY ("studyPeriodId") REFERENCES "StudyPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE "StudentCourse";
DROP TYPE "StudentCourseStatus";
