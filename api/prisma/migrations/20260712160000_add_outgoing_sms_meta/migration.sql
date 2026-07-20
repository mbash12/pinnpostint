-- AlterTable
ALTER TABLE "outgoing_sms" ADD COLUMN IF NOT EXISTS "meta" JSONB;
