-- AlterTable
ALTER TABLE "app"."JobRequest" ADD COLUMN     "parameters" JSONB,
ADD COLUMN     "parentJobId" TEXT,
ADD COLUMN     "partitionKey" TEXT;

-- CreateIndex
CREATE INDEX "JobRequest_type_name_partitionKey_status_idx" ON "app"."JobRequest"("type", "name", "partitionKey", "status");

-- AddForeignKey
ALTER TABLE "app"."JobRequest" ADD CONSTRAINT "JobRequest_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "app"."JobRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
