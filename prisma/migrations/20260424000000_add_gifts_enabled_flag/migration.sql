-- Global kill-switch для подарочной программы.
-- Когда gifts_enabled="false":
-- - /api/gifts/available возвращает []
-- - /api/gifts/next-threshold возвращает null
-- - createOrder игнорирует selectedGiftId (на случай гонки toggle vs submit)
-- - CartGiftProgress прогресс-бар подарка скрывается (giftThreshold=0 через API)
--
-- ON CONFLICT на key-unique защищает от повторного запуска миграции.
INSERT INTO "DeliverySetting" (id, key, value, "updatedAt")
VALUES (gen_random_uuid()::text, 'gifts_enabled', 'true', NOW())
ON CONFLICT (key) DO NOTHING;
