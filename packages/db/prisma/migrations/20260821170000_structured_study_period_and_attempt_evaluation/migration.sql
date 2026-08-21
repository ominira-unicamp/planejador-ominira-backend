BEGIN;

ALTER TABLE "StudyPeriod"
    ADD COLUMN "year" INTEGER,
    ADD COLUMN "yearPeriod" "YearPeriods";

UPDATE "StudyPeriod"
SET
    "year" = substring("code" FROM '^[0-9]{4}')::INTEGER,
    "yearPeriod" = CASE
        WHEN lower("code") ~ 's1$' THEN 'FIRST_SEMESTER'::"YearPeriods"
        WHEN lower("code") ~ 's2$' THEN 'SECOND_SEMESTER'::"YearPeriods"
        WHEN lower("code") ~ '(v|verao)$' THEN 'SUMMER'::"YearPeriods"
        WHEN lower("code") ~ '(i|inverno)$' THEN 'WINTER'::"YearPeriods"
        ELSE NULL
    END;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "StudyPeriod"
        WHERE "year" IS NULL OR "yearPeriod" IS NULL
    ) THEN
        RAISE EXCEPTION 'StudyPeriod.code contains a value that cannot be converted to year/yearPeriod';
    END IF;
END $$;

ALTER TABLE "StudyPeriod"
    ALTER COLUMN "year" SET NOT NULL,
    ALTER COLUMN "yearPeriod" SET NOT NULL;

DROP INDEX "StudyPeriod_code_key";
ALTER TABLE "StudyPeriod" DROP COLUMN "code";
CREATE UNIQUE INDEX "StudyPeriod_year_yearPeriod_key"
    ON "StudyPeriod"("year", "yearPeriod");
CREATE INDEX "StudyPeriod_year_idx" ON "StudyPeriod"("year");

ALTER TABLE "StudentCourseAttempt"
    ADD COLUMN "evaluationMode" "CourseEvaluationMode";

UPDATE "StudentCourseAttempt" AS attempt
SET "evaluationMode" = COALESCE(
    (
        SELECT catalog_course."evaluation"
        FROM "Class" AS class_data
        JOIN "StudyPeriod" AS class_period
            ON class_period."id" = class_data."studyPeriodId"
        JOIN "Catalog" AS catalog
            ON catalog."year" = class_period."year"
        JOIN "CatalogCourse" AS catalog_course
            ON catalog_course."catalogId" = catalog."id"
            AND catalog_course."courseId" = attempt."courseId"
        WHERE class_data."id" = attempt."classId"
          AND catalog_course."evaluation" IS NOT NULL
        LIMIT 1
    ),
    (
        SELECT catalog_course."evaluation"
        FROM "StudyPeriod" AS direct_period
        JOIN "Catalog" AS catalog
            ON catalog."year" = direct_period."year"
        JOIN "CatalogCourse" AS catalog_course
            ON catalog_course."catalogId" = catalog."id"
            AND catalog_course."courseId" = attempt."courseId"
        WHERE direct_period."id" = attempt."studyPeriodId"
          AND catalog_course."evaluation" IS NOT NULL
        LIMIT 1
    ),
    'GRADE_AND_ATTENDANCE'::"CourseEvaluationMode"
);

CREATE TYPE "StudentCourseAttemptStatus_new" AS ENUM (
    'ENROLLED',
    'DROPPED',
    'APPROVED',
    'FAILED_BY_GRADE',
    'APPROVED_BY_ATTENDANCE',
    'FAILED_BY_ATTENDANCE',
    'SUFFICIENT',
    'INSUFFICIENT'
);

ALTER TABLE "StudentCourseAttempt"
    ALTER COLUMN "status" TYPE "StudentCourseAttemptStatus_new"
    USING CASE
        WHEN "status"::TEXT IN ('ENROLLED', 'DROPPED')
            THEN "status"::TEXT
        WHEN "status"::TEXT = 'COMPLETED'
            AND "evaluationMode" = 'ATTENDANCE'::"CourseEvaluationMode"
            THEN 'APPROVED_BY_ATTENDANCE'
        WHEN "status"::TEXT = 'COMPLETED'
            AND "evaluationMode" = 'CONCEPT'::"CourseEvaluationMode"
            THEN 'SUFFICIENT'
        WHEN "status"::TEXT = 'COMPLETED'
            THEN 'APPROVED'
        WHEN "status"::TEXT = 'FAILED'
            AND "evaluationMode" = 'ATTENDANCE'::"CourseEvaluationMode"
            THEN 'FAILED_BY_ATTENDANCE'
        WHEN "status"::TEXT = 'FAILED'
            AND "evaluationMode" = 'CONCEPT'::"CourseEvaluationMode"
            THEN 'INSUFFICIENT'
        ELSE 'FAILED_BY_GRADE'
    END::"StudentCourseAttemptStatus_new";

DROP TYPE "StudentCourseAttemptStatus";
ALTER TYPE "StudentCourseAttemptStatus_new" RENAME TO "StudentCourseAttemptStatus";

ALTER TABLE "StudentCourseAttempt"
    ALTER COLUMN "evaluationMode" SET NOT NULL;

COMMIT;
