-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "smsConsent" BOOLEAN,
ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "smsConsentText" TEXT;

