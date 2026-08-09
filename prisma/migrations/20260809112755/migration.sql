/*
  Warnings:

  - A unique constraint covering the columns `[programId,code]` on the table `Specialization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `programId` to the `Specialization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Specialization" ADD COLUMN     "programId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_programId_code_key" ON "Specialization"("programId", "code");

-- AddForeignKey
ALTER TABLE "Specialization" ADD CONSTRAINT "Specialization_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
