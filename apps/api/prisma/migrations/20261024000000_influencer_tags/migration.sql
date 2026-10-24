-- CreateTable
CREATE TABLE "influencer_tags" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "influencer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "influencer_tags_label_key" ON "influencer_tags"("label");

-- CreateTable
CREATE TABLE "influencer_tag_assignments" (
    "influencerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "influencer_tag_assignments_pkey" PRIMARY KEY ("influencerId","tagId")
);

-- CreateIndex
CREATE INDEX "influencer_tag_assignments_tagId_idx" ON "influencer_tag_assignments"("tagId");

-- AddForeignKey
ALTER TABLE "influencer_tag_assignments" ADD CONSTRAINT "influencer_tag_assignments_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_tag_assignments" ADD CONSTRAINT "influencer_tag_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "influencer_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
