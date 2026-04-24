-- F2-1: UserConsent для хранения согласия на обработку ПД (152-ФЗ).
CREATE TABLE "UserConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "emailSnapshot" TEXT,
  "type" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "source" TEXT NOT NULL,
  "orderId" TEXT,
  CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserConsent_userId_type_idx" ON "UserConsent"("userId", "type");
CREATE INDEX "UserConsent_type_acceptedAt_idx" ON "UserConsent"("type", "acceptedAt");

ALTER TABLE "UserConsent"
  ADD CONSTRAINT "UserConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
