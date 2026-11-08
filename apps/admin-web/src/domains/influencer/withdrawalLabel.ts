import type { InfluencerWithdrawal, WithdrawalReason } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";

/** 사유 라벨은 목록 다이얼로그와 CSV 가 함께 쓴다 — 매핑은 여기 한 곳에만. */
export const WITHDRAWAL_REASON_LABEL_KEY: Record<
  WithdrawalReason,
  AdminTranslationKey
> = {
  NOT_ENOUGH_CAMPAIGNS: "domains.influencer.withdrawal.reasonNotEnoughCampaigns",
  GUIDELINE_BURDEN: "domains.influencer.withdrawal.reasonGuidelineBurden",
  REWARD_UNSATISFIED: "domains.influencer.withdrawal.reasonRewardUnsatisfied",
  USING_OTHER_PLATFORM: "domains.influencer.withdrawal.reasonUsingOtherPlatform",
  SNS_INACTIVE: "domains.influencer.withdrawal.reasonSnsInactive",
  OTHER: "domains.influencer.withdrawal.reasonOther",
};

/**
 * 목록 배지의 툴팁 문구 — 신청일시·사유·상세 의견.
 * 승인 버튼이 없는 일반 매니저도 신청 내용을 목록에서 바로 읽을 수 있어야 한다.
 */
export function withdrawalTooltip(
  withdrawal: InfluencerWithdrawal,
  translateKey: (key: AdminTranslationKey) => string,
): string {
  const lines = [
    `${translateKey("domains.influencer.withdrawal.requestedAt")}: ${new Date(
      withdrawal.requestedAt,
    ).toLocaleString()}`,
    `${translateKey("domains.influencer.withdrawal.reason")}: ${translateKey(
      WITHDRAWAL_REASON_LABEL_KEY[withdrawal.reason],
    )}`,
  ];
  if (withdrawal.reasonDetail.trim() !== "") {
    lines.push(
      `${translateKey("domains.influencer.withdrawal.reasonDetail")}: ${withdrawal.reasonDetail}`,
    );
  }
  if (withdrawal.rejectReason) {
    lines.push(
      `${translateKey("domains.influencer.withdrawal.rejectReason")}: ${withdrawal.rejectReason}`,
    );
  }
  return lines.join("\n");
}
