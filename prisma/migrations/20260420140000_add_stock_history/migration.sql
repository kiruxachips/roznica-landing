-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "lowStockThreshold" INTEGER;

-- CreateTable
CREATE TABLE "StockHistory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "notes" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockHistory_variantId_createdAt_idx" ON "StockHistory"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockHistory_orderId_idx" ON "StockHistory"("orderId");

-- CreateIndex
CREATE INDEX "StockHistory_reason_idx" ON "StockHistory"("reason");

-- AddForeignKey
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
