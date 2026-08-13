/*
  Warnings:

  - You are about to drop the `Teacher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ClassToTeacher` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ClassToTeacher" DROP CONSTRAINT "_ClassToTeacher_A_fkey";

-- DropForeignKey
ALTER TABLE "_ClassToTeacher" DROP CONSTRAINT "_ClassToTeacher_B_fkey";

-- DropTable
DROP TABLE "Teacher";

-- DropTable
DROP TABLE "_ClassToTeacher";

-- CreateTable
CREATE TABLE "Professor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClassToProfessor" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClassToProfessor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ClassToProfessor_B_index" ON "_ClassToProfessor"("B");

-- AddForeignKey
ALTER TABLE "_ClassToProfessor" ADD CONSTRAINT "_ClassToProfessor_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToProfessor" ADD CONSTRAINT "_ClassToProfessor_B_fkey" FOREIGN KEY ("B") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
