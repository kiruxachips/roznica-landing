-- G1-1: welcome-discount на первый заказ.
ALTER TABLE "User" ADD COLUMN "firstOrderCompletedAt" TIMESTAMP(3);
CREATE INDEX "User_firstOrderCompletedAt_idx" ON "User"("firstOrderCompletedAt");

-- Настройки по умолчанию через DeliverySetting (тот же key-value, что
-- gifts_enabled/bonus_rate). Админ может менять через /admin/delivery.
INSERT INTO "DeliverySetting" ("id", "key", "value", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'welcome_discount_enabled', 'true', NOW()),
  (gen_random_uuid()::text, 'welcome_discount_percent', '10', NOW()),
  (gen_random_uuid()::text, 'welcome_discount_max', '500', NOW())  -- cap ₽
ON CONFLICT ("key") DO NOTHING;

-- Backfill существующих User: если у них уже есть хотя бы один paid/confirmed/
-- shipped/delivered Order — значит первый заказ уже давно сделан, welcome
-- не применять.
UPDATE "User" u
SET "firstOrderCompletedAt" = (
  SELECT MIN(o."createdAt")
  FROM "Order" o
  WHERE o."userId" = u.id
    AND o."status" IN ('paid', 'confirmed', 'shipped', 'delivered')
)
WHERE EXISTS (
  SELECT 1 FROM "Order" o
  WHERE o."userId" = u.id
    AND o."status" IN ('paid', 'confirmed', 'shipped', 'delivered')
);
