-- CreateTable
CREATE TABLE "DeliverySetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryMarkupRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "minWeight" INTEGER,
    "maxWeight" INTEGER,
    "minPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryMarkupRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliverySetting_key_key" ON "DeliverySetting"("key");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "carrierOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "carrierOrderNum" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupPointCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupPointName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryType" TEXT;
ALTER TABLE "Order" ADD COLUMN "destinationCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "destinationCityCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "carrierStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "estimatedDelivery" TEXT;
ALTER TABLE "Order" ADD COLUMN "packageWeight" INTEGER;
ALTER TABLE "Order" ADD COLUMN "tariffCode" INTEGER;
