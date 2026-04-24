-- Wholesale tier-discount pricing by total cart weight + быстрая регистрация

-- 1. Переход WholesaleCompany.status на новый union (совместимо: старые "active" остаются "active")
-- Дефолт меняем на "pending_info" для новых записей
ALTER TABLE "WholesaleCompany" ALTER COLUMN "status" SET DEFAULT 'pending_info';

-- 2. Дефолт PriceList.kind — weight_tier (новые листы сразу на новой модели)
ALTER TABLE "PriceList" ALTER COLUMN "kind" SET DEFAULT 'weight_tier';

-- 3. Новая таблица PriceListWeightTier
CREATE TABLE "PriceListWeightTier" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "minWeightGrams" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListWeightTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceListWeightTier_priceListId_minWeightGrams_key"
    ON "PriceListWeightTier"("priceListId", "minWeightGrams");
CREATE INDEX "PriceListWeightTier_priceListId_idx"
    ON "PriceListWeightTier"("priceListId");

ALTER TABLE "PriceListWeightTier"
    ADD CONSTRAINT "PriceListWeightTier_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
