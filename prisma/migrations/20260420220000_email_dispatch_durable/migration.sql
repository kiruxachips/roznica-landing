-- AlterTable
ALTER TABLE "EmailDispatch"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "html" TEXT,
  ADD COLUMN "fromEmail" TEXT,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "EmailDispatch_status_nextAttemptAt_idx" ON "EmailDispatch"("status", "nextAttemptAt");
