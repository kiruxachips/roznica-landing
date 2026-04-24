-- F4-2: денормализованные avgRating + reviewCount на Product.
-- Убирает N+1 запрос на каталоге: вместо подгрузки reviews для каждого
-- продукта — один Float/Int в Product-строке.

ALTER TABLE "Product" ADD COLUMN "avgRating" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill существующих данных — ГРУППА по productId с фильтром isVisible
-- (только видимые отзывы учитываются в rating, как и в текущей DAL-логике).
UPDATE "Product" p
SET
  "reviewCount" = COALESCE(r.count, 0),
  "avgRating" = r.avg
FROM (
  SELECT
    "productId",
    COUNT(*)::int AS count,
    AVG("rating")::float AS avg
  FROM "Review"
  WHERE "isVisible" = true
  GROUP BY "productId"
) AS r
WHERE p.id = r."productId";
