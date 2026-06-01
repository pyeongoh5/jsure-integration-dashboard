-- CreateTable
CREATE TABLE "submitted_post_attachments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submitted_post_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submitted_post_attachments_objectKey_key" ON "submitted_post_attachments"("objectKey");

-- CreateIndex
CREATE INDEX "submitted_post_attachments_postId_idx" ON "submitted_post_attachments"("postId");

-- AddForeignKey
ALTER TABLE "submitted_post_attachments" ADD CONSTRAINT "submitted_post_attachments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "submitted_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
