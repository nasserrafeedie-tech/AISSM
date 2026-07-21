-- What each customer actually costs to serve.
--
-- The ~90% margin assumes model calls are cheap. Nothing has ever measured it,
-- and a chatty owner who revises every draft costs many times a quiet one.
--
-- Token counts, not dollars: counts are facts that never change, prices are
-- not, and a rate correction should never require rewriting history. Cost is
-- derived at read time from llm/pricing.ts.
CREATE TABLE "llm_usage" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  -- Null for work not tied to one customer — playbook research is paid once
  -- and reused by every business in that trade.
  "customerId"       UUID,
  "model"            TEXT         NOT NULL,
  "tier"             TEXT         NOT NULL,
  "inputTokens"      INTEGER      NOT NULL DEFAULT 0,
  "outputTokens"     INTEGER      NOT NULL DEFAULT 0,
  -- Cached input bills differently from fresh: reads are a fraction, writes a
  -- premium. Kept apart so the saving from prompt caching stays visible.
  "cacheReadTokens"  INTEGER      NOT NULL DEFAULT 0,
  "cacheWriteTokens" INTEGER      NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_usage_customerId_createdAt_idx" ON "llm_usage" ("customerId", "createdAt");
CREATE INDEX "llm_usage_createdAt_idx" ON "llm_usage" ("createdAt");

-- When the last month-in-review text went out. The recap sweep runs daily and
-- the send window is several days wide, so without this an owner would get the
-- same recap every day of that window.
ALTER TABLE "customers" ADD COLUMN "lastRecapAt" TIMESTAMP(3);
