-- CreateTable
CREATE TABLE "data"."ExchangeNotice" (
    "id" SERIAL NOT NULL,
    "naturalKey" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "title" TEXT,
    "placeId" INTEGER,
    "registrationOriginalText" TEXT,
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),

    CONSTRAINT "ExchangeNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data"."ExchangeNoticeFile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "url" TEXT,
    "noticeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeNoticeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data"."ExchangePlace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "ExchangePlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ExchangeNoticeSubscription" (
    "studentId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeNoticeSubscription_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "app"."ExchangeNoticeSubscriptionPlace" (
    "subscriptionStudentId" INTEGER NOT NULL,
    "placeId" INTEGER NOT NULL,

    CONSTRAINT "ExchangeNoticeSubscriptionPlace_pkey" PRIMARY KEY ("subscriptionStudentId","placeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeNotice_naturalKey_key" ON "data"."ExchangeNotice"("naturalKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeNoticeFile_noticeId_normalizedName_key" ON "data"."ExchangeNoticeFile"("noticeId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangePlace_normalizedName_key" ON "data"."ExchangePlace"("normalizedName");

-- AddForeignKey
ALTER TABLE "data"."ExchangeNotice" ADD CONSTRAINT "ExchangeNotice_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "data"."ExchangePlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data"."ExchangeNoticeFile" ADD CONSTRAINT "ExchangeNoticeFile_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "data"."ExchangeNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeNoticeSubscription" ADD CONSTRAINT "ExchangeNoticeSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "app"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeNoticeSubscriptionPlace" ADD CONSTRAINT "ExchangeNoticeSubscriptionPlace_subscriptionStudentId_fkey" FOREIGN KEY ("subscriptionStudentId") REFERENCES "app"."ExchangeNoticeSubscription"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeNoticeSubscriptionPlace" ADD CONSTRAINT "ExchangeNoticeSubscriptionPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "data"."ExchangePlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
