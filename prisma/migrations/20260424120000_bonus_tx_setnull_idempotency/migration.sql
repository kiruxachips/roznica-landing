-- P0-2: BonusTransaction.userId → nullable + onDelete SetNull + idempotencyKey
-- Защита финансовой истории при удалении/анонимизации пользователя (152-ФЗ
-- + внутренний аудит баланса). Безопасная миграция: существующие записи
-- сохраняют userId, новая колонка idempotencyKey null для старых.

-- 1. Drop old FK constraint (Cascade)
ALTER TABLE "BonusTransaction" DROP CONSTRAINT "BonusTransaction_userId_fkey";

-- 2. Сделать userId nullable
ALTER TABLE "BonusTransaction" ALTER COLUMN "userId" DROP NOT NULL;

-- 3. Воссоздать FK с SetNull
ALTER TABLE "BonusTransaction"
  ADD CONSTRAINT "BonusTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Добавить idempotencyKey (nullable, unique)
ALTER TABLE "BonusTransaction" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "BonusTransaction_idempotencyKey_key"
  ON "BonusTransaction"("idempotencyKey");

-- 5. Compound index для hot-path запросов (юзер + тип + дата)
CREATE INDEX "BonusTransaction_userId_type_createdAt_idx"
  ON "BonusTransaction"("userId", "type", "createdAt");
