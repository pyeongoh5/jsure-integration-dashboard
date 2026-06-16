-- AlterTable
ALTER TABLE "influencer_memos" ADD COLUMN     "campaignId" TEXT;

-- AddForeignKey
ALTER TABLE "influencer_memos" ADD CONSTRAINT "influencer_memos_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
