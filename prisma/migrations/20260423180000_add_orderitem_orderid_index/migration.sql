-- Индекс на OrderItem.orderId. FK сам по себе в Postgres НЕ создаёт индекс
-- для JOIN-стороны. Каждая загрузка заказа (order.items) делала seq-scan
-- по всей таблице OrderItem — сейчас данных мало (16 строк) и разница
-- незаметна, но на 10k+ заказов это уже дорого. Ставим индекс upfront.
--
-- Обычный CREATE INDEX (не CONCURRENTLY) — Prisma требует транзакции.
-- На текущем размере таблицы выполняется миллисекунды, лок приемлем.
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
