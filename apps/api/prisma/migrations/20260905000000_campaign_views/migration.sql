-- CreateTable
CREATE TABLE "campaign_views" (
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,

    CONSTRAINT "campaign_views_pkey" PRIMARY KEY ("campaignId","influencerId")
);

-- CreateIndex
CREATE INDEX "campaign_views_campaignId_idx" ON "campaign_views"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_views" ADD CONSTRAINT "campaign_views_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_views" ADD CONSTRAINT "campaign_views_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
