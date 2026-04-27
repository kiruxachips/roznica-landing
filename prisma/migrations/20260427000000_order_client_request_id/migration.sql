-- C1: idempotency для createOrder. Колонка nullable, чтобы существующие
-- заказы без clientRequestId остались валидными.
ALTER TABLE "Order" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "Order_clientRequestId_key" ON "Order"("clientRequestId");
