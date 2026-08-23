import type {
  AdminInfluencerSnsAccount,
  CampaignSubType,
} from "@jsure/shared";

/** 키는 CampaignSubType — 화면에서 캠페인 서브타입으로 바로 조회하기 위함(SNS 계열만 값이 채워진다). */
export type HandleBySubType = Partial<Record<CampaignSubType, string>>;

/** SNS 채널별 핸들 맵 — 채널 아이콘에 프로필 아웃링크를 걸 때 사용한다. */
export function toHandleBySubType(
  accounts: AdminInfluencerSnsAccount[],
): HandleBySubType {
  const result: HandleBySubType = {};
  for (const account of accounts) {
    if (account.handle) result[account.snsType] = account.handle;
  }
  return result;
}
