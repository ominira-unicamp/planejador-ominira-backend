/*
  Warnings:

  - A unique constraint covering the columns `[authUserId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuthUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthRole" AS ENUM ('STUDENT', 'BOT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('ACADEMIC_WRITE');

-- CreateEnum
CREATE TYPE "StudentCapability" AS ENUM ('STUDENT_PROFILE_READ', 'STUDENT_PROFILE_WRITE', 'STUDENT_HISTORY_READ', 'STUDENT_HISTORY_WRITE', 'STUDENT_PLANNING_READ', 'STUDENT_PLANNING_WRITE');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "authUserId" INTEGER;

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" SERIAL NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "status" "AuthUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUserRole" (
    "authUserId" INTEGER NOT NULL,
    "role" "AuthRole" NOT NULL,

    CONSTRAINT "AuthUserRole_pkey" PRIMARY KEY ("authUserId","role")
);

-- CreateTable
CREATE TABLE "AuthUserCapability" (
    "authUserId" INTEGER NOT NULL,
    "capability" "Capability" NOT NULL,

    CONSTRAINT "AuthUserCapability_pkey" PRIMARY KEY ("authUserId","capability")
);

-- CreateTable
CREATE TABLE "BotGrant" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "botAuthUserId" INTEGER NOT NULL,
    "capability" "StudentCapability" NOT NULL,
    "grantedByAuthUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByAuthUserId" INTEGER,

    CONSTRAINT "BotGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_issuer_subject_key" ON "AuthUser"("issuer", "subject");

-- CreateIndex
CREATE INDEX "BotGrant_studentId_botAuthUserId_capability_revokedAt_idx" ON "BotGrant"("studentId", "botAuthUserId", "capability", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_authUserId_key" ON "Student"("authUserId");

-- AddForeignKey
ALTER TABLE "AuthUserRole" ADD CONSTRAINT "AuthUserRole_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUserCapability" ADD CONSTRAINT "AuthUserCapability_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGrant" ADD CONSTRAINT "BotGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGrant" ADD CONSTRAINT "BotGrant_botAuthUserId_fkey" FOREIGN KEY ("botAuthUserId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGrant" ADD CONSTRAINT "BotGrant_grantedByAuthUserId_fkey" FOREIGN KEY ("grantedByAuthUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGrant" ADD CONSTRAINT "BotGrant_revokedByAuthUserId_fkey" FOREIGN KEY ("revokedByAuthUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
