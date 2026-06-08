-- CreateEnum
CREATE TYPE "BroadcastJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "broadcast_jobs" (
    "id" TEXT NOT NULL,
    "status" "BroadcastJobStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "contentHtml" TEXT NOT NULL,
    "heroImageR2Key" TEXT,
    "altText" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "influencerIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "broadcast_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_jobs_status_createdAt_idx" ON "broadcast_jobs"("status", "createdAt");
