-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CalendarTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CalendarEventToCalendarTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CalendarEventToCalendarTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_endDate_idx" ON "CalendarEvent"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTag_name_key" ON "CalendarTag"("name");

-- CreateIndex
CREATE INDEX "_CalendarEventToCalendarTag_B_index" ON "_CalendarEventToCalendarTag"("B");

-- AddForeignKey
ALTER TABLE "_CalendarEventToCalendarTag" ADD CONSTRAINT "_CalendarEventToCalendarTag_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToCalendarTag" ADD CONSTRAINT "_CalendarEventToCalendarTag_B_fkey" FOREIGN KEY ("B") REFERENCES "CalendarTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
