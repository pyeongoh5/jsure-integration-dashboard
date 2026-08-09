-- CreateEnum
CREATE TYPE "CrossPostPlatform" AS ENUM ('LIPS', 'ATCOSME', 'TIKTOK', 'YOUTUBE', 'X', 'OTHER');

-- CreateTable
CREATE TABLE "cross_posts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "platform" "CrossPostPlatform" NOT NULL,
    "platformName" TEXT,
    "url" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cross_posts_applicationId_idx" ON "cross_posts"("applicationId");

-- AddForeignKey
ALTER TABLE "cross_posts" ADD CONSTRAINT "cross_posts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
