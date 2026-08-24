/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StudentFriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentCapability" ADD VALUE 'STUDENT_SOCIAL_READ';
ALTER TYPE "StudentCapability" ADD VALUE 'STUDENT_SOCIAL_WRITE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "publicBio" VARCHAR(280),
ADD COLUMN     "publicDisplayName" VARCHAR(80),
ADD COLUMN     "publicId" TEXT NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showEntryYear" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showProgram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSpecialization" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentFriendship" (
    "id" SERIAL NOT NULL,
    "studentAId" INTEGER NOT NULL,
    "studentBId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "status" "StudentFriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFriendship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFriendship_studentAId_status_idx" ON "StudentFriendship"("studentAId", "status");

-- CreateIndex
CREATE INDEX "StudentFriendship_studentBId_status_idx" ON "StudentFriendship"("studentBId", "status");

-- CreateIndex
CREATE INDEX "StudentFriendship_requestedById_status_idx" ON "StudentFriendship"("requestedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFriendship_studentAId_studentBId_key" ON "StudentFriendship"("studentAId", "studentBId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_publicId_key" ON "Student"("publicId");

-- AddForeignKey
ALTER TABLE "StudentFriendship" ADD CONSTRAINT "StudentFriendship_studentAId_fkey" FOREIGN KEY ("studentAId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFriendship" ADD CONSTRAINT "StudentFriendship_studentBId_fkey" FOREIGN KEY ("studentBId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFriendship" ADD CONSTRAINT "StudentFriendship_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
