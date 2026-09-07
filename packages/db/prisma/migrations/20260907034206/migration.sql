-- CreateTable
CREATE TABLE "app"."Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "parentTagId" INTEGER,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."CourseTag" (
    "courseId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "CourseTag_pkey" PRIMARY KEY ("courseId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "app"."Category"("name");

-- CreateIndex
CREATE INDEX "Tag_parentTagId_idx" ON "app"."Tag"("parentTagId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_categoryId_name_key" ON "app"."Tag"("categoryId", "name");

-- CreateIndex
CREATE INDEX "CourseTag_tagId_idx" ON "app"."CourseTag"("tagId");

-- AddForeignKey
ALTER TABLE "app"."Tag" ADD CONSTRAINT "Tag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "app"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Tag" ADD CONSTRAINT "Tag_parentTagId_fkey" FOREIGN KEY ("parentTagId") REFERENCES "app"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CourseTag" ADD CONSTRAINT "CourseTag_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "data"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CourseTag" ADD CONSTRAINT "CourseTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "app"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
