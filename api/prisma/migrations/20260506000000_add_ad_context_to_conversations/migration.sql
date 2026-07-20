-- Add optional ad context to conversations so the same two users can have
-- separate chat rooms depending on which ad (and thus which role) they are
-- discussing. A NULL adId means a "general" conversation.
ALTER TABLE "conversations"
ADD COLUMN "adId" TEXT;

-- Drop the old unique constraint/index that forced one conversation per user pair.
ALTER TABLE "conversations"
DROP CONSTRAINT IF EXISTS "conversations_buyerId_sellerId_key";
DROP INDEX IF EXISTS "conversations_buyerId_sellerId_key";

-- Add the new composite unique that allows multiple conversations per pair
-- as long as they're scoped to different ads (or both general, guarded in app).
-- PostgreSQL treats NULLs as distinct in unique constraints, so application
-- code prevents duplicate general conversations.
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_buyerId_sellerId_adId_key" UNIQUE ("buyerId", "sellerId", "adId");

-- Foreign key to ads table (set null on ad deletion so conversation persists).
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE SET NULL;
