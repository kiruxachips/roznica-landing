-- Композитный индекс под фильтрацию каталога по стране происхождения
-- (CTA "Кофе по странам" + groupBy в getFilterOptions). На 41 продукте
-- эффект скромный, но индекс копеечный и убирает Seq Scan при ?origin=...
-- На таком размере CREATE INDEX выполняется за миллисекунды; CONCURRENTLY
-- не используем, потому что Prisma migrate оборачивает файл в транзакцию.
CREATE INDEX IF NOT EXISTS "Product_isActive_productType_origin_idx"
  ON "Product"("isActive", "productType", "origin");
