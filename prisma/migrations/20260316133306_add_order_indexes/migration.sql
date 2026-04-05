-- CreateIndex
CREATE INDEX "Order_paymentId_idx" ON "Order"("paymentId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_deliveryMethod_status_idx" ON "Order"("deliveryMethod", "status");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
