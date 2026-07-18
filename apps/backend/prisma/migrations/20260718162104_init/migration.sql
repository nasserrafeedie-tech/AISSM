-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('approve_all', 'auto_low_risk', 'full_auto');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('onboarding', 'active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'threads', 'youtube');

-- CreateEnum
CREATE TYPE "PostArchetype" AS ENUM ('promo', 'behind_the_scenes', 'testimonial', 'educational_tip', 'product_spotlight', 'seasonal', 'ugc_repost', 'were_open');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('not_required', 'awaiting_owner', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('pending', 'passed', 'blocked');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'high');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('owner_upload', 'ai_generated', 'assembled');

-- CreateEnum
CREATE TYPE "ShotListStatus" AS ENUM ('requested', 'fulfilled', 'skipped', 'expired');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('emitted', 'running', 'done', 'needs_owner_input', 'pending_approval', 'failed');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT,
    "planTier" TEXT NOT NULL DEFAULT 'starter',
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'approve_all',
    "status" "CustomerStatus" NOT NULL DEFAULT 'onboarding',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "scopes" TEXT[],
    "postForMeRef" TEXT,
    "externalHandle" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "businessType" TEXT,
    "voiceTone" TEXT,
    "targetCustomer" TEXT,
    "offers" TEXT[],
    "dosAndDonts" TEXT[],
    "blackoutTopics" TEXT[],
    "postingFrequency" INTEGER NOT NULL DEFAULT 3,
    "brandColors" TEXT[],
    "logoRef" TEXT,
    "referencePhotoRefs" TEXT[],
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "archetype" "PostArchetype" NOT NULL,
    "platform" "Platform" NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[],
    "mediaRefs" TEXT[],
    "scheduledTime" TIMESTAMP(3),
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "approvalState" "ApprovalState" NOT NULL DEFAULT 'not_required',
    "moderationState" "ModerationState" NOT NULL DEFAULT 'pending',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'low',
    "externalPostId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "postId" UUID,
    "kind" "MediaKind" NOT NULL,
    "source" "MediaSource" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_list_requests" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "postId" UUID,
    "prompt" TEXT NOT NULL,
    "status" "ShotListStatus" NOT NULL DEFAULT 'requested',
    "fulfilledBy" UUID,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "shot_list_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "externalPostId" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT,
    "mediaUrls" TEXT[],
    "twilioSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'emitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "summaryForOwner" TEXT NOT NULL,
    "data" JSONB,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_stripeCustomerId_key" ON "customers"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "connected_accounts_customerId_idx" ON "connected_accounts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_customerId_platform_key" ON "connected_accounts"("customerId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_customerId_key" ON "brand_profiles"("customerId");

-- CreateIndex
CREATE INDEX "posts_customerId_status_idx" ON "posts"("customerId", "status");

-- CreateIndex
CREATE INDEX "posts_status_scheduledTime_idx" ON "posts"("status", "scheduledTime");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_r2Key_key" ON "media_assets"("r2Key");

-- CreateIndex
CREATE INDEX "media_assets_customerId_idx" ON "media_assets"("customerId");

-- CreateIndex
CREATE INDEX "shot_list_requests_customerId_status_idx" ON "shot_list_requests"("customerId", "status");

-- CreateIndex
CREATE INDEX "metrics_postId_idx" ON "metrics"("postId");

-- CreateIndex
CREATE INDEX "metrics_customerId_fetchedAt_idx" ON "metrics"("customerId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_customerId_key" ON "conversations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_twilioSid_key" ON "messages"("twilioSid");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_customerId_createdAt_idx" ON "tasks"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "results_taskId_key" ON "results"("taskId");

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_list_requests" ADD CONSTRAINT "shot_list_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_list_requests" ADD CONSTRAINT "shot_list_requests_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
