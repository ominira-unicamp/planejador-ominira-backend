-- CreateEnum
CREATE TYPE "MealPeriod" AS ENUM ('LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "DietaryOption" AS ENUM ('TRADITIONAL', 'VEGAN');

-- CreateEnum
CREATE TYPE "MealStatus" AS ENUM ('AVAILABLE', 'NOT_REGISTERED');

-- CreateTable
CREATE TABLE "DailyMenu" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" SERIAL NOT NULL,
    "dailyMenuId" INTEGER NOT NULL,
    "period" "MealPeriod" NOT NULL,
    "diet" "DietaryOption" NOT NULL,
    "status" "MealStatus" NOT NULL,
    "mainDish" TEXT,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" SERIAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealObservation" (
    "id" SERIAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "MealObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealServiceNote" (
    "id" SERIAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "MealServiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAbsence" (
    "id" SERIAL NOT NULL,
    "studentCourseAttemptId" INTEGER NOT NULL,
    "classScheduleId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_date_key" ON "DailyMenu"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_dailyMenuId_period_diet_key" ON "Meal"("dailyMenuId", "period", "diet");

-- CreateIndex
CREATE UNIQUE INDEX "MealServiceNote_mealId_text_key" ON "MealServiceNote"("mealId", "text");

-- CreateIndex
CREATE INDEX "StudentAbsence_studentCourseAttemptId_date_idx" ON "StudentAbsence"("studentCourseAttemptId", "date");

-- CreateIndex
CREATE INDEX "StudentAbsence_classScheduleId_date_idx" ON "StudentAbsence"("classScheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAbsence_studentCourseAttemptId_classScheduleId_date_key" ON "StudentAbsence"("studentCourseAttemptId", "classScheduleId", "date");

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_dailyMenuId_fkey" FOREIGN KEY ("dailyMenuId") REFERENCES "DailyMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealObservation" ADD CONSTRAINT "MealObservation_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealServiceNote" ADD CONSTRAINT "MealServiceNote_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAbsence" ADD CONSTRAINT "StudentAbsence_studentCourseAttemptId_fkey" FOREIGN KEY ("studentCourseAttemptId") REFERENCES "StudentCourseAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAbsence" ADD CONSTRAINT "StudentAbsence_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
