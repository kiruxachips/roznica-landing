-- G2: Referral program.
CREATE TABLE "ReferralCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "totalRewardEarned" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");
ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReferralRedemption" (
  "id" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "referrerReward" INTEGER NOT NULL,
  "referredReward" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralRedemption_orderId_key" ON "ReferralRedemption"("orderId");
CREATE INDEX "ReferralRedemption_referredUserId_idx" ON "ReferralRedemption"("referredUserId");
CREATE INDEX "ReferralRedemption_referralCodeId_createdAt_idx"
  ON "ReferralRedemption"("referralCodeId", "createdAt");
ALTER TABLE "ReferralRedemption"
  ADD CONSTRAINT "ReferralRedemption_referralCodeId_fkey"
  FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Дефолты в DeliverySetting для referral.
INSERT INTO "DeliverySetting" ("id", "key", "value", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'referral_enabled', 'true', NOW()),
  (gen_random_uuid()::text, 'referral_inviter_bonus', '500', NOW()),
  (gen_random_uuid()::text, 'referral_invitee_bonus', '200', NOW())
ON CONFLICT ("key") DO NOTHING;
