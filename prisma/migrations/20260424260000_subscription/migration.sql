-- G4: Subscription (регулярная доставка).
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "intervalDays" INTEGER NOT NULL,
  "discountPercent" INTEGER NOT NULL DEFAULT 5,
  "status" TEXT NOT NULL DEFAULT 'active',
  "nextDeliveryDate" TIMESTAMP(3) NOT NULL,
  "pausedUntil" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deliveryAddressSnapshot" JSONB,
  "lastOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_status_nextDeliveryDate_idx"
  ON "Subscription"("status", "nextDeliveryDate");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
