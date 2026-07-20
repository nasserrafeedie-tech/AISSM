-- CreateTable
CREATE TABLE "queued_texts" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "sendAfter" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queued_texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queued_texts_sentAt_sendAfter_idx" ON "queued_texts"("sentAt", "sendAfter");

-- AddForeignKey
ALTER TABLE "queued_texts" ADD CONSTRAINT "queued_texts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

