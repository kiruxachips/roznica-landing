-- G1: модель Gift + связка с Order.
-- Раньше подарок существовал только как visual-обещалка в UI-прогрессе
-- корзины; backend-логика полностью отсутствовала. Теперь пул подарков
-- управляется через /admin/gifts, клиент на checkout выбирает один из
-- доступных для своего cartTotal, выбор сохраняется в Order.selectedGiftId
-- и попадает в email/track/admin.

CREATE TABLE "Gift" (
    "id"           TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "description"  TEXT,
    "imageUrl"     TEXT,
    "imageAlt"     TEXT,
    "minCartTotal" INTEGER      NOT NULL DEFAULT 0,
    "stock"        INTEGER,
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "sortOrder"    INTEGER      NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Gift_isActive_minCartTotal_idx" ON "Gift"("isActive", "minCartTotal");

-- Order: nullable FK + snapshot имени (чтобы при удалении Gift исторические
-- заказы не теряли информацию о том, что положили).
ALTER TABLE "Order" ADD COLUMN "selectedGiftId"   TEXT;
ALTER TABLE "Order" ADD COLUMN "giftNameSnapshot" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_selectedGiftId_fkey"
  FOREIGN KEY ("selectedGiftId") REFERENCES "Gift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_selectedGiftId_idx" ON "Order"("selectedGiftId");
