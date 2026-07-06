-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "atlasId" INTEGER,
ADD COLUMN     "buildingId" INTEGER,
ADD COLUMN     "details" TEXT;

-- CreateTable
CREATE TABLE "Building" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "unitId" INTEGER,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_unitId_code_key" ON "Building"("unitId", "code");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
