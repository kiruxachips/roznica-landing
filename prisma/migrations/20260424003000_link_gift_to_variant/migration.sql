-- GP1: линк Gift → ProductVariant (опциональный).
-- Позволяет дарить товары из каталога (особенно залежавшиеся неликвиды)
-- с автоматическим декрементом ProductVariant.stock через adjustStock.
-- Кастомные подарки (productVariantId=NULL) продолжают работать через
-- собственный Gift.stock.
ALTER TABLE "Gift" ADD COLUMN "productVariantId" TEXT;

ALTER TABLE "Gift" ADD CONSTRAINT "Gift_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Gift_productVariantId_idx" ON "Gift"("productVariantId");
