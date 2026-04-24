-- F1-5: Compound indexes для hot-path запросов.
-- Prisma migrate deploy делает каждую миграцию в своей транзакции, поэтому
-- CONCURRENTLY использовать нельзя (требует non-tx контекст). На текущем
-- объёме данных (≤ 10k строк в Order, ~1k в EmailDispatch) обычный CREATE
-- INDEX занимает < 100мс и не блокирует чтения значительно — приемлемо.
-- Если БД вырастет на порядок — переведём на `prisma db execute` с раздельным
-- CONCURRENTLY запуском.

-- Order: заказы юзера в статусе за период (профиль клиента, фильтр).
CREATE INDEX "Order_userId_status_createdAt_idx"
  ON "Order"("userId", "status", "createdAt");

-- EmailDispatch: replay queue по типу письма (e.g. "все cart.abandoned в failed за сутки").
CREATE INDEX "EmailDispatch_kind_status_createdAt_idx"
  ON "EmailDispatch"("kind", "status", "createdAt");

-- VerificationCode: cron cleanup expired+unused по email.
CREATE INDEX "VerificationCode_email_expiresAt_idx"
  ON "VerificationCode"("email", "expiresAt");

-- AdminActivityLog: compliance audit (например, «кто менял заказы за месяц»).
CREATE INDEX "AdminActivityLog_action_entityType_createdAt_idx"
  ON "AdminActivityLog"("action", "entityType", "createdAt");

-- ProcessedInboundEvent: TTL cleanup по source + возраст.
CREATE INDEX "ProcessedInboundEvent_source_createdAt_idx"
  ON "ProcessedInboundEvent"("source", "createdAt");
