-- CreateTable
CREATE TABLE "EmailDispatch" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "response" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDispatch_orderId_kind_recipient_status_idx" ON "EmailDispatch"("orderId", "kind", "recipient", "status");

-- CreateIndex
CREATE INDEX "EmailDispatch_orderId_createdAt_idx" ON "EmailDispatch"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDispatch_status_createdAt_idx" ON "EmailDispatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDispatch_kind_createdAt_idx" ON "EmailDispatch"("kind", "createdAt");
