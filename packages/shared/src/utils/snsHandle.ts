import type { SnsAccountSubType } from "../types/influencer.js";

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
