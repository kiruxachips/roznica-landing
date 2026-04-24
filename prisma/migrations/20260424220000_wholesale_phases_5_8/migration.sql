-- Wholesale Cabinet — Phases 5-8
-- Документы (Invoice), multi-user (Invitation), DaData snapshot, credit alerts.

-- ==========================================================================
-- 1. Новые поля в существующих таблицах
-- ==========================================================================

-- WholesaleCompany: credit alerts + DaData
ALTER TABLE "WholesaleCompany" ADD COLUMN "creditAlertSentAt"    TIMESTAMP(3);
ALTER TABLE "WholesaleCompany" ADD COLUMN "creditAlertPctSent"   INTEGER;
ALTER TABLE "WholesaleCompany" ADD COLUMN "dadataStatus"         TEXT;
ALTER TABLE "WholesaleCompany" ADD COLUMN "dadataCheckedAt"      TIMESTAMP(3);
ALTER TABLE "WholesaleCompany" ADD COLUMN "dadataPayload"        JSONB;

-- WholesaleUser: passwordHash становится nullable (pending-invitation)
ALTER TABLE "WholesaleUser" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- ==========================================================================
-- 2. Новые таблицы
-- ==========================================================================

-- WholesaleInvitation
CREATE TABLE "WholesaleInvitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "token" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleInvitation_token_key" ON "WholesaleInvitation"("token");
CREATE INDEX "WholesaleInvitation_companyId_idx" ON "WholesaleInvitation"("companyId");
CREATE INDEX "WholesaleInvitation_email_idx" ON "WholesaleInvitation"("email");
CREATE INDEX "WholesaleInvitation_expiresAt_idx" ON "WholesaleInvitation"("expiresAt");

ALTER TABLE "WholesaleInvitation"
    ADD CONSTRAINT "WholesaleInvitation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- WholesaleInvoice — счёт/УПД/акт
CREATE TABLE "WholesaleInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'invoice',
    "orderId" TEXT,
    "companyId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "vatRate" INTEGER,
    "vatAmount" INTEGER,
    "buyerSnapshot" JSONB NOT NULL,
    "sellerSnapshot" JSONB NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pdfUrl" TEXT,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WholesaleInvoice_number_key" ON "WholesaleInvoice"("number");
CREATE UNIQUE INDEX "WholesaleInvoice_orderId_key" ON "WholesaleInvoice"("orderId");
CREATE INDEX "WholesaleInvoice_companyId_createdAt_idx" ON "WholesaleInvoice"("companyId", "createdAt");
CREATE INDEX "WholesaleInvoice_status_idx" ON "WholesaleInvoice"("status");
CREATE INDEX "WholesaleInvoice_kind_createdAt_idx" ON "WholesaleInvoice"("kind", "createdAt");

ALTER TABLE "WholesaleInvoice"
    ADD CONSTRAINT "WholesaleInvoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "WholesaleCompany"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
