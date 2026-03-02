-- AlterTable
ALTER TABLE "Order" ADD COLUMN "thankYouToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_thankYouToken_key" ON "Order"("thankYouToken");
