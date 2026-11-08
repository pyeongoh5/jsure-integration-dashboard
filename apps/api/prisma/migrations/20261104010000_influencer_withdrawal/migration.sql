-- 인플루언서 셀프 탈퇴 신청과 관리자 승인/반려 기록.
-- 전부 신규 타입·테이블 추가라 기존 row 와 구 코드에 영향이 없다.

CREATE TYPE "WithdrawalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "WithdrawalReason" AS ENUM (
  'NOT_ENOUGH_CAMPAIGNS',
  'GUIDELINE_BURDEN',
  'REWARD_UNSATISFIED',
  'USING_OTHER_PLATFORM',
  'SNS_INACTIVE',
  'OTHER'
);

CREATE TABLE "influencer_withdrawals" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "reason" "WithdrawalReason" NOT NULL,
  "reasonDetail" TEXT NOT NULL DEFAULT '',
  "decision" "WithdrawalDecision" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  "rejectReason" TEXT,

  CONSTRAINT "influencer_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "influencer_withdrawals_influencerId_requestedAt_idx"
  ON "influencer_withdrawals" ("influencerId", "requestedAt");

CREATE INDEX "influencer_withdrawals_decision_requestedAt_idx"
  ON "influencer_withdrawals" ("decision", "requestedAt");

-- 한 인플루언서가 동시에 가질 수 있는 대기 건은 1개. 반려 후 재신청은 허용해야 하므로
-- 전체 유니크가 아니라 PENDING 에만 거는 부분 인덱스다.
-- ⚠️ Prisma 스키마로는 표현할 수 없는 인덱스다(PostgreSQL 부분 인덱스 미지원).
--    이후 `prisma migrate dev` 가 생성하는 SQL 에 이 인덱스를 DROP 하는 구문이
--    섞이지 않는지 반드시 눈으로 확인할 것.
CREATE UNIQUE INDEX "influencer_withdrawals_one_pending_per_influencer"
  ON "influencer_withdrawals" ("influencerId")
  WHERE "decision" = 'PENDING';

ALTER TABLE "influencer_withdrawals"
  ADD CONSTRAINT "influencer_withdrawals_influencerId_fkey"
  FOREIGN KEY ("influencerId") REFERENCES "influencers" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 처리한 관리자 계정이 지워져도 신청 기록 자체는 남아야 한다.
ALTER TABLE "influencer_withdrawals"
  ADD CONSTRAINT "influencer_withdrawals_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "admin_users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
