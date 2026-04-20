-- Add status column to AdminUser
ALTER TABLE "AdminUser" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- CreateTable for activity log
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "adminName" TEXT,
    "adminRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminActivityLog_adminUserId_createdAt_idx" ON "AdminActivityLog"("adminUserId", "createdAt");
CREATE INDEX "AdminActivityLog_action_createdAt_idx" ON "AdminActivityLog"("action", "createdAt");
CREATE INDEX "AdminActivityLog_entityType_entityId_idx" ON "AdminActivityLog"("entityType", "entityId");
CREATE INDEX "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");

ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
