-- 탈퇴 승인 시점의 SNS 보유 현황 스냅샷.
--
-- 승인 시 influencer_sns_accounts 가 삭제되므로 채널별 이탈 분석이 불가능했다.
-- 삭제 직전 값을 여기 떠둔다. 개인 특정을 막기 위해 핸들은 담지 않고
-- 채널 종류와 팔로워 수만 남긴다.
ALTER TABLE "influencer_withdrawals" ADD COLUMN "snsSnapshot" JSONB;
