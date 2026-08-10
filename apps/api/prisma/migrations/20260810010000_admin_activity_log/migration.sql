-- 어드민 액션 감사 로그. 테이블·enum 추가만 하는 additive 마이그레이션 —
-- 기존 테이블 무변경이라 배포 순간 구버전 코드와 공존 가능하다.
CREATE TYPE "AdminActivityOrigin" AS ENUM ('ADMIN', 'CASCADE', 'SYSTEM');

CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "origin" "AdminActivityOrigin" NOT NULL DEFAULT 'ADMIN',
    "actorId" TEXT,
    "actorName" TEXT,
    "applicationId" TEXT,
    "campaignId" TEXT,
    "settlementId" TEXT,
    "influencerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- 응모건별 타임라인 조회용. 대상 참조에 FK 를 걸지 않으므로 인덱스만 둔다.
CREATE INDEX "admin_activity_logs_applicationId_createdAt_idx" ON "admin_activity_logs"("applicationId", "createdAt");
CREATE INDEX "admin_activity_logs_createdAt_idx" ON "admin_activity_logs"("createdAt");
