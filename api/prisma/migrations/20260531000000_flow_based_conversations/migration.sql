-- Flow-based conversations: one conversation per buyer-seller direction.
-- Merge duplicate conversations (same pair, different ads) by keeping the
-- most recent one and moving all messages to it.

-- Step 1: Identify duplicates (keep most recent per pair, mark rest for deletion)
CREATE TEMPORARY TABLE convs_to_delete AS
WITH ranked AS (
  SELECT
    id,
    LEAST("buyerId", "sellerId") as user_a,
    GREATEST("buyerId", "sellerId") as user_b,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST("buyerId", "sellerId"), GREATEST("buyerId", "sellerId")
      ORDER BY "lastMessageAt" DESC
    ) as rn
  FROM "conversations"
)
SELECT id, user_a, user_b FROM ranked WHERE rn > 1;

-- Step 2: Identify conversations to keep (one per pair)
CREATE TEMPORARY TABLE convs_to_keep AS
WITH ranked AS (
  SELECT
    id,
    LEAST("buyerId", "sellerId") as user_a,
    GREATEST("buyerId", "sellerId") as user_b,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST("buyerId", "sellerId"), GREATEST("buyerId", "sellerId")
      ORDER BY "lastMessageAt" DESC
    ) as rn
  FROM "conversations"
)
SELECT id, user_a, user_b FROM ranked WHERE rn = 1;

-- Step 3: Move messages from deleted conversations to the kept conversation
UPDATE "messages" m
SET "conversationId" = ck.id
FROM convs_to_delete d
JOIN convs_to_keep ck ON ck.user_a = d.user_a AND ck.user_b = d.user_b
WHERE m."conversationId" = d.id;

-- Step 4: Delete duplicate conversations
DELETE FROM "conversations"
WHERE id IN (SELECT id FROM convs_to_delete);

-- Step 5: Drop temporary tables
DROP TABLE IF EXISTS convs_to_delete;
DROP TABLE IF EXISTS convs_to_keep;

-- Step 6: Drop the old ad-scoped unique constraint
ALTER TABLE "conversations"
DROP CONSTRAINT IF EXISTS "conversations_buyerId_sellerId_adId_key";

-- Step 7: Add the new flow-based unique constraint
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_buyerId_sellerId_key" UNIQUE ("buyerId", "sellerId");

-- Step 8: Drop the adId column from conversations (no longer needed)
ALTER TABLE "conversations"
DROP COLUMN IF EXISTS "adId";

-- Step 9: Drop the foreign key constraint on adId
ALTER TABLE "conversations"
DROP CONSTRAINT IF EXISTS "conversations_adId_fkey";
