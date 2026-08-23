import type {
  CampaignSubType,
  SnsAccountSubType,
} from "../types/influencer.js";

/**
 * SNS 핸들 정책: 저장/전송은 항상 bare(앞에 `@` 없음). 표시 시점에만 `@`를 붙인다.
 * 자세한 규칙은 `.claude/CODE_RULES.md` §6 참고.
 */
export function normalizeSnsHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function displaySnsHandle(handle: string): string {
  return `@${handle}`;
}

/** SNS 타입별 표준 프로필 URL. 핸들은 bare 로 가정하지만 안전하게 normalize 한다. */
export function buildSnsProfileUrl(
  snsType: SnsAccountSubType,
  handle: string,
): string {
  const bare = normalizeSnsHandle(handle);
  switch (snsType) {
    case "INSTAGRAM":
      return `https://www.instagram.com/${bare}/`;
    case "TIKTOK":
      return `https://www.tiktok.com/@${bare}`;
    case "X":
      return `https://x.com/${bare}`;
    case "YOUTUBE":
      return `https://www.youtube.com/@${bare}`;
  }
}

const SNS_ACCOUNT_SUB_TYPES = new Set<string>([
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
]);

/**
 * 프로필 아웃링크용 URL. 핸들이 없거나 SNS 계열이 아닌 서브타입(QOO10/LIPS/ATCOSME)이면 null.
 * 링크를 걸 수 있는지 판단하는 지점은 모두 이 함수를 경유한다.
 */
export function snsProfileUrlOrNull(
  subType: CampaignSubType,
  handle: string | null | undefined,
): string | null {
  const bare = handle ? normalizeSnsHandle(handle) : "";
  if (!bare || !SNS_ACCOUNT_SUB_TYPES.has(subType)) return null;
  return buildSnsProfileUrl(subType as SnsAccountSubType, bare);
}
