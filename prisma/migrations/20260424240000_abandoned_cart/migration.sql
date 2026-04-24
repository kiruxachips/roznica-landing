-- G3: Abandoned cart tracking для email-recovery.
CREATE TABLE "AbandonedCart" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "items" JSONB NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "recoveryToken" TEXT NOT NULL,
  "promoCodeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'tracked',
  "emailSentAt" TIMESTAMP(3),
  "recoveredAt" TIMESTAMP(3),
  "recoveredOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbandonedCart_recoveryToken_key" ON "AbandonedCart"("recoveryToken");
CREATE INDEX "AbandonedCart_email_status_idx" ON "AbandonedCart"("email", "status");
CREATE INDEX "AbandonedCart_status_createdAt_idx" ON "AbandonedCart"("status", "createdAt");
CREATE INDEX "AbandonedCart_userId_idx" ON "AbandonedCart"("userId");
