-- DropForeignKey
ALTER TABLE "BrandXCredential" DROP CONSTRAINT "BrandXCredential_campaignId_fkey";

-- AlterTable
ALTER TABLE "BrandCampaign" DROP COLUMN "xUserId",
DROP COLUMN "xUsername",
ADD COLUMN     "brandAccountId" TEXT;

-- DropTable
DROP TABLE "BrandXCredential";

-- CreateTable
CREATE TABLE "BrandXAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "xUserId" TEXT,
    "xUsername" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "refreshFailedAt" TIMESTAMP(3),
    "refreshFailCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandXAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandXAccount_xUserId_key" ON "BrandXAccount"("xUserId");

-- AddForeignKey
ALTER TABLE "BrandCampaign" ADD CONSTRAINT "BrandCampaign_brandAccountId_fkey" FOREIGN KEY ("brandAccountId") REFERENCES "BrandXAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

