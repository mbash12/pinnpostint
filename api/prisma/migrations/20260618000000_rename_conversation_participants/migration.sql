-- Rename conversation participants from buyer/seller to generic userA/userB.
-- Participants are stored in deterministic UUID order (smaller UUID = userA).

-- Step 1: Normalize ordering so the smaller UUID is always buyerId (will become userAId).
UPDATE "conversations"
SET "buyerId" = "sellerId", "sellerId" = "buyerId"
WHERE "buyerId" > "sellerId";

-- Step 2: Rename columns.
ALTER TABLE "conversations" RENAME COLUMN "buyerId" TO "userAId";
ALTER TABLE "conversations" RENAME COLUMN "sellerId" TO "userBId";

-- Step 3: Rename the unique constraint.
ALTER TABLE "conversations"
RENAME CONSTRAINT "conversations_buyerId_sellerId_key" TO "conversations_userAId_userBId_key";

-- Step 4: Rename foreign key constraints.
ALTER TABLE "conversations"
RENAME CONSTRAINT "conversations_buyerId_fkey" TO "conversations_userAId_fkey";

ALTER TABLE "conversations"
RENAME CONSTRAINT "conversations_sellerId_fkey" TO "conversations_userBId_fkey";
