-- CreateEnum
CREATE TYPE "PostReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "submitted_posts" ADD COLUMN     "reviewStatus" "PostReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "submitted_post_rejections" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectedById" TEXT,

    CONSTRAINT "submitted_post_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submitted_post_rejections_postId_idx" ON "submitted_post_rejections"("postId");

-- CreateIndex
CREATE INDEX "submitted_posts_reviewStatus_idx" ON "submitted_posts"("reviewStatus");

-- AddForeignKey
ALTER TABLE "submitted_post_rejections" ADD CONSTRAINT "submitted_post_rejections_postId_fkey" FOREIGN KEY ("postId") REFERENCES "submitted_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
