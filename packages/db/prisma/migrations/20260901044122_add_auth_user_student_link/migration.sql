/*
  Warnings:

  - You are about to drop the column `authUserId` on the `Student` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_authUserId_fkey";

-- DropIndex
DROP INDEX "Student_authUserId_key";

-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "studentId" INTEGER;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "authUserId";

-- CreateIndex
CREATE INDEX "AuthUser_studentId_idx" ON "AuthUser"("studentId");

-- AddForeignKey
ALTER TABLE "AuthUser" ADD CONSTRAINT "AuthUser_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
