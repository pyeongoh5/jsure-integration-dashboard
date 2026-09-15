-- DropForeignKey
ALTER TABLE "BrandCampaign" DROP CONSTRAINT "BrandCampaign_brandAccountId_fkey";

-- AlterTable
ALTER TABLE "PostTemplate" ADD COLUMN     "cardFingerprint" TEXT,
ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "cardTitle" TEXT;

-- AddForeignKey
ALTER TABLE "BrandCampaign" ADD CONSTRAINT "BrandCampaign_brandAccountId_fkey" FOREIGN KEY ("brandAccountId") REFERENCES "BrandXAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
