-- Permanent guest-tracking token. В отличие от one-shot thankYouToken (Метрика goal),
-- живёт всю жизнь заказа и даёт гостю доступ к /track/[orderNumber] из email.
ALTER TABLE "Order" ADD COLUMN "trackingToken" TEXT;

CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");

-- Backfill для последних 30 дней: старые pending письма уже могли уйти со старой
-- ссылкой на /account/orders, новые письма будут использовать /track/. Но если
-- пользователь кликнет повторно на старое письмо после деплоя — тоже хочется,
-- чтобы работало. Токены уникальны, детерминированы по id через md5 заказа.
UPDATE "Order"
SET "trackingToken" = CONCAT('trk_', SUBSTRING(MD5("id" || RANDOM()::TEXT) FROM 1 FOR 32))
WHERE "trackingToken" IS NULL
  AND "createdAt" > NOW() - INTERVAL '30 days';
