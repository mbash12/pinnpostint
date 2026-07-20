-- CreateEnum
CREATE TYPE "OutgoingSmsStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "outgoing_sms" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "templateId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'notification',
    "status" "OutgoingSmsStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "outgoing_sms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outgoing_sms_status_nextRetryAt_idx" ON "outgoing_sms"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "outgoing_sms_kind_status_idx" ON "outgoing_sms"("kind", "status");

-- CreateIndex
CREATE INDEX "outgoing_sms_status_createdAt_idx" ON "outgoing_sms"("status", "createdAt" DESC);
