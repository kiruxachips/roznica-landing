-- F1-2: User.deletedAt для soft-delete (GDPR-like flow в /account/delete).
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- F1-3: StockHistory.variantId nullable + onDelete SetNull.
-- История продаж/приходов должна пережить удаление варианта.
ALTER TABLE "StockHistory" DROP CONSTRAINT "StockHistory_variantId_fkey";
ALTER TABLE "StockHistory" ALTER COLUMN "variantId" DROP NOT NULL;
ALTER TABLE "StockHistory"
  ADD CONSTRAINT "StockHistory_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
