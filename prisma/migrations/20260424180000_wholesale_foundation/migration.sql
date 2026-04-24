-- Wholesale Cabinet (B2B) foundation
-- See docs/wholesale-cabinet-plan-2026-04-24.md

-- ==========================================================================
-- 1. Новые поля в существующих таблицах (все nullable или с DEFAULT — безопасно для прода)
-- ==========================================================================

-- ProductVariant: опциональный минимальный оптовый заказ
ALTER TABLE "ProductVariant" ADD COLUMN "wholesaleMinQuantity" INTEGER;

-- PromoCode: канал применимости
ALTER TABLE "PromoCode" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'retail';

-- Order: B2B-разметка
ALTER TABLE "Order" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE "Order" ADD COLUMN "wholesaleCompanyId" TEXT;
ALTER TABLE "Order" ADD COLUMN "wholesaleUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Order" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "b2bLegalName" TEXT;
ALTER TABLE "Order" ADD COLUMN "b2bInn" TEXT;
ALTER TABLE "Order" ADD COLUMN "b2bKpp" TEXT;

-- ==========================================================================
-- 2. Новые таблицы
-- ==========================================================================

-- WholesaleCompany — контрагент
CREATE TABLE "WholesaleCompany" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "brandName" TEXT,
    "inn" TEXT NOT NULL,
    "kpp" TEXT,
    "ogrn" TEXT,
    "legalAddress" TEXT,
    "postalAddress" TEXT,
    "bankName" TEXT,
    "bankBic" TEXT,
    "bankAccount" TEXT,
    "corrAccount" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "paymentTerms" TEXT NOT NULL DEFAULT 'prepay',
    "creditLimit" INTEGER NOT NULL DEFAULT 0,
    "creditUsed" INTEGER NOT NULL DEFAULT 0,
    "priceListId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "managerAdminId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleCompany_inn_key" ON "WholesaleCompany"("inn");
CREATE INDEX "WholesaleCompany_status_idx" ON "WholesaleCompany"("status");
CREATE INDEX "WholesaleCompany_managerAdminId_idx" ON "WholesaleCompany"("managerAdminId");
CREATE INDEX "WholesaleCompany_priceListId_idx" ON "WholesaleCompany"("priceListId");

-- WholesaleUser — сотрудник компании
CREATE TABLE "WholesaleUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "companyId" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleUser_email_key" ON "WholesaleUser"("email");
CREATE INDEX "WholesaleUser_companyId_idx" ON "WholesaleUser"("companyId");

-- WholesaleAccessRequest — публичные заявки на доступ
CREATE TABLE "WholesaleAccessRequest" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "expectedVolume" TEXT,
    "comment" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WholesaleAccessRequest_status_createdAt_idx" ON "WholesaleAccessRequest"("status", "createdAt");
CREATE INDEX "WholesaleAccessRequest_inn_idx" ON "WholesaleAccessRequest"("inn");
CREATE INDEX "WholesaleAccessRequest_contactEmail_idx" ON "WholesaleAccessRequest"("contactEmail");

-- PriceList — коллекция цен
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'fixed',
    "discountPct" INTEGER,
    "minOrderSum" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceList_isActive_idx" ON "PriceList"("isActive");

-- PriceListItem — цена за конкретный вариант
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceListItem_priceListId_variantId_minQuantity_key"
    ON "PriceListItem"("priceListId", "variantId", "minQuantity");
CREATE INDEX "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");
CREATE INDEX "PriceListItem_variantId_idx" ON "PriceListItem"("variantId");

-- WholesaleCreditTransaction — ledger кредитных операций
CREATE TABLE "WholesaleCreditTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "description" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleCreditTransaction_idempotencyKey_key"
    ON "WholesaleCreditTransaction"("idempotencyKey");
CREATE INDEX "WholesaleCreditTransaction_companyId_createdAt_idx"
    ON "WholesaleCreditTransaction"("companyId", "createdAt");
CREATE INDEX "WholesaleCreditTransaction_orderId_idx"
    ON "WholesaleCreditTransaction"("orderId");

-- WholesaleDocument — файлы/PDF для компании
CREATE TABLE "WholesaleDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WholesaleDocument_companyId_kind_createdAt_idx"
    ON "WholesaleDocument"("companyId", "kind", "createdAt");
CREATE INDEX "WholesaleDocument_orderId_idx" ON "WholesaleDocument"("orderId");

-- ==========================================================================
-- 3. Foreign keys
-- ==========================================================================

-- Order → WholesaleCompany (SetNull, чтобы не ломать историю при удалении компании)
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_wholesaleCompanyId_fkey"
    FOREIGN KEY ("wholesaleCompanyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- WholesaleCompany → PriceList (SetNull)
ALTER TABLE "WholesaleCompany"
    ADD CONSTRAINT "WholesaleCompany_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- WholesaleUser → WholesaleCompany (Cascade: удаляем компанию → удаляем юзеров)
ALTER TABLE "WholesaleUser"
    ADD CONSTRAINT "WholesaleUser_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- WholesaleAccessRequest → WholesaleCompany (SetNull)
ALTER TABLE "WholesaleAccessRequest"
    ADD CONSTRAINT "WholesaleAccessRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- PriceListItem → PriceList (Cascade)
ALTER TABLE "PriceListItem"
    ADD CONSTRAINT "PriceListItem_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- PriceListItem → ProductVariant (Cascade: удаляем вариант → удаляем цену)
ALTER TABLE "PriceListItem"
    ADD CONSTRAINT "PriceListItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- WholesaleCreditTransaction → WholesaleCompany (Restrict: финансовый аудит не удаляем)
ALTER TABLE "WholesaleCreditTransaction"
    ADD CONSTRAINT "WholesaleCreditTransaction_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- WholesaleDocument → WholesaleCompany (Cascade: удаляем компанию → удаляем документы)
ALTER TABLE "WholesaleDocument"
    ADD CONSTRAINT "WholesaleDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- 4. Индексы по новым полям в Order
-- ==========================================================================

CREATE INDEX "Order_channel_status_createdAt_idx" ON "Order"("channel", "status", "createdAt");
CREATE INDEX "Order_wholesaleCompanyId_createdAt_idx" ON "Order"("wholesaleCompanyId", "createdAt");
CREATE INDEX "Order_approvalStatus_idx" ON "Order"("approvalStatus");
