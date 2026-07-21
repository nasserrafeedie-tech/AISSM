-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "pendingIntent" TEXT,
ADD COLUMN     "pendingIntentAt" TIMESTAMP(3);

