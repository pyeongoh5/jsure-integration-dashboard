-- Enums
CREATE TYPE "SnsType" AS ENUM ('INSTAGRAM', 'TIKTOK', 'X', 'YOUTUBE');
CREATE TYPE "InfluencerEntityType" AS ENUM ('INDIVIDUAL', 'CORPORATE');
CREATE TYPE "InfluencerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "JpAccountType" AS ENUM ('FUTSU', 'TOUZA');
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'REJECTED', 'APPROVED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- Campaign: convert snsTypes String[] -> SnsType[] preserving data
ALTER TABLE "campaigns"
  ALTER COLUMN "snsTypes" DROP DEFAULT,
  ALTER COLUMN "snsTypes" TYPE "SnsType"[] USING ("snsTypes"::"SnsType"[]);

-- Campaign: new columns
ALTER TABLE "campaigns"
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "brandTagline" TEXT,
  ADD COLUMN "minFollowers" INTEGER;

-- Influencer
CREATE TABLE "influencers" (
  "id"           TEXT PRIMARY KEY,
  "email"        TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "nameKana"     TEXT,
  "phone"        TEXT NOT NULL,
  "entityType"   "InfluencerEntityType" NOT NULL,
  "memo"         TEXT,
  "status"       "InfluencerStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);

-- InfluencerSession
CREATE TABLE "influencer_sessions" (
  "id"               TEXT PRIMARY KEY,
  "influencerId"     TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL UNIQUE,
  "userAgent"        TEXT,
  "ip"               TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "revokedAt"        TIMESTAMP(3),
  CONSTRAINT "influencer_sessions_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "influencer_sessions_influencerId_idx" ON "influencer_sessions"("influencerId");

-- InfluencerSnsAccount
CREATE TABLE "influencer_sns_accounts" (
  "id"            TEXT PRIMARY KEY,
  "influencerId"  TEXT NOT NULL,
  "snsType"       "SnsType" NOT NULL,
  "handle"        TEXT NOT NULL,
  "followerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "influencer_sns_accounts_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "influencer_sns_accounts_influencerId_snsType_key" ON "influencer_sns_accounts"("influencerId", "snsType");

-- InfluencerConsent
CREATE TABLE "influencer_consents" (
  "id"           TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "agreedItems"  TEXT[],
  "agreedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"           TEXT,
  "userAgent"    TEXT,
  CONSTRAINT "influencer_consents_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "influencer_consents_influencerId_termsVersion_idx" ON "influencer_consents"("influencerId", "termsVersion");

-- InfluencerBankAccount
CREATE TABLE "influencer_bank_accounts" (
  "id"                TEXT PRIMARY KEY,
  "influencerId"      TEXT NOT NULL UNIQUE,
  "ownerType"         "InfluencerEntityType" NOT NULL,
  "bankCode"          TEXT NOT NULL,
  "bankName"          TEXT NOT NULL,
  "branchName"        TEXT NOT NULL,
  "accountType"       "JpAccountType" NOT NULL,
  "accountNumber"     TEXT NOT NULL,
  "accountHolderKana" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "influencer_bank_accounts_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CampaignApplication
CREATE TABLE "campaign_applications" (
  "id"             TEXT PRIMARY KEY,
  "campaignId"     TEXT NOT NULL,
  "influencerId"   TEXT NOT NULL,
  "status"         "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "appliedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"     TIMESTAMP(3),
  "reviewedById"   TEXT,
  "rejectReason"   TEXT,
  "trackingNumber" TEXT,
  "shippedAt"      TIMESTAMP(3),
  "deliveredAt"    TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_applications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_applications_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campaign_applications_campaignId_influencerId_key" ON "campaign_applications"("campaignId", "influencerId");
CREATE INDEX "campaign_applications_campaignId_status_idx" ON "campaign_applications"("campaignId", "status");
CREATE INDEX "campaign_applications_influencerId_status_idx" ON "campaign_applications"("influencerId", "status");

-- SubmittedPost
CREATE TABLE "submitted_posts" (
  "id"                  TEXT PRIMARY KEY,
  "applicationId"       TEXT NOT NULL,
  "snsType"             "SnsType" NOT NULL,
  "url"                 TEXT NOT NULL,
  "submittedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "insightSaves"        INTEGER,
  "insightReach"        INTEGER,
  "insightProfileViews" INTEGER,
  "insightSubmittedAt"  TIMESTAMP(3),
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "submitted_posts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "submitted_posts_applicationId_snsType_key" ON "submitted_posts"("applicationId", "snsType");
CREATE INDEX "submitted_posts_applicationId_idx" ON "submitted_posts"("applicationId");
