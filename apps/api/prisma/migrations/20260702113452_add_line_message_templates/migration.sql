-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('SNS', 'FAKE_PURCHASE');

-- CreateEnum
CREATE TYPE "LineTriggerKey" AS ENUM ('SNS_APPLICATION_APPLIED', 'SNS_APPLICATION_APPROVED', 'SNS_APPLICATION_REJECTED', 'SNS_APPLICATION_SHIPPED', 'SNS_APPLICATION_DELIVERED', 'SNS_APPLICATION_RECEIPT_CONFIRMED', 'SNS_POST_SUBMITTED', 'SNS_POST_DEADLINE_REMINDER', 'SNS_POST_APPROVED', 'SNS_POST_REJECTED', 'SNS_POST_REJECTION_REMINDER', 'SNS_INSIGHT_SUBMITTED', 'SNS_INSIGHT_REMINDER', 'SNS_SETTLEMENT_COMPLETED', 'SNS_CAMPAIGN_COMPLETED');

-- CreateEnum
CREATE TYPE "LineTriggerSubType" AS ENUM ('INSTAGRAM', 'X');

-- CreateEnum
CREATE TYPE "LineDispatchStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED_DISABLED', 'SKIPPED_NO_TEMPLATE');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "testLineUserId" TEXT;

-- CreateTable
CREATE TABLE "line_message_templates" (
    "id" TEXT NOT NULL,
    "category" "CampaignCategory" NOT NULL,
    "subType" "LineTriggerSubType",
    "triggerKey" "LineTriggerKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "line_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_dispatch_logs" (
    "id" TEXT NOT NULL,
    "category" "CampaignCategory" NOT NULL,
    "subType" "LineTriggerSubType",
    "triggerKey" "LineTriggerKey" NOT NULL,
    "templateId" TEXT,
    "applicationId" TEXT,
    "toLineUserId" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" "LineDispatchStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_dispatch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "line_message_templates_category_subType_triggerKey_key" ON "line_message_templates"("category", "subType", "triggerKey");

-- CreateIndex
CREATE INDEX "line_dispatch_logs_applicationId_triggerKey_idx" ON "line_dispatch_logs"("applicationId", "triggerKey");

-- CreateIndex
CREATE INDEX "line_dispatch_logs_createdAt_idx" ON "line_dispatch_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "line_dispatch_logs" ADD CONSTRAINT "line_dispatch_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "line_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_dispatch_logs" ADD CONSTRAINT "line_dispatch_logs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
