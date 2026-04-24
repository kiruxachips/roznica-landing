-- G1-2: NewsletterSubscriber для email-подписок (новинки, промо).
CREATE TABLE "NewsletterSubscriber" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "subscriptionGroups" TEXT[] NOT NULL DEFAULT ARRAY['promotions']::TEXT[],
  "userId" TEXT,
  "source" TEXT,
  "unsubscribeToken" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key"
  ON "NewsletterSubscriber"("unsubscribeToken");
CREATE INDEX "NewsletterSubscriber_status_createdAt_idx"
  ON "NewsletterSubscriber"("status", "createdAt");
CREATE INDEX "NewsletterSubscriber_userId_idx" ON "NewsletterSubscriber"("userId");

ALTER TABLE "NewsletterSubscriber"
  ADD CONSTRAINT "NewsletterSubscriber_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
