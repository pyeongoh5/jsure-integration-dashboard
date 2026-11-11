-- 정산이 완료된 응모를 COMPLETED 로 백필한다.
--
-- 지금까지 정산 완료는 settlements.status 만 바꾸고 응모 상태는 그대로 두었다.
-- 그 결과 끝난 건이 영원히 REVIEW_SUBMITTED 에 머물러 "진행 중"을 묻는 판정
-- (탈퇴 차단 등)이 모두 오작동했다. 응모 상태를 COMPLETED 로 올리고 종료 시각은
-- 정산 완료 시각으로 맞춘다.
--
-- 진행 구간에 있는 건만 대상 — 반려·취소된 건은 건드리지 않는다.
UPDATE "campaign_applications" AS ca
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE(s."completedAt", NOW())
FROM "settlements" AS s
WHERE s."applicationId" = ca."id"
  AND s."status" = 'COMPLETED'
  AND ca."status" IN (
    'APPROVED',
    'SHIPPED',
    'DELIVERED',
    'ORDER_SUBMITTED',
    'REVIEW_SUBMITTED'
  );
