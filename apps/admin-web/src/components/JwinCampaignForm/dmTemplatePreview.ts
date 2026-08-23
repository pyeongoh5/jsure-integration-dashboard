/**
 * 당첨 DM 문구의 플레이스홀더 치환 — 서버 `apps/jwin-api/src/services/fulfillment.ts`
 * 의 `renderDmText` / `DEFAULT_DM_TEMPLATE` 과 같은 규칙을 화면에서 미리 보여준다.
 *
 * 기본 문구가 일본어인 것은 최종 수신자가 일본 유저이기 때문이다. 어드민 화면 문구가
 * 아니라 실제 발송되는 데이터라서 i18n 대상이 아니다(서버 원문 그대로).
 */
export const DEFAULT_DM_TEMPLATE = [
  "【{{BRAND_NAME}}】ご当選おめでとうございます！",
  "賞品: {{PRIZE_NAME}}",
  "ギフトコード: {{CODE}}",
  "※このDMは自動送信です。",
].join("\n");

export type DmPreviewValues = {
  code: string;
  prizeName: string;
  username: string;
  brandName: string;
};

/** 미리보기용 예시 값. brandName 은 호출부에서 실제 캠페인 브랜드명으로 덮어쓴다. */
export const DM_PREVIEW_SAMPLE: DmPreviewValues = {
  code: "ABCD-1234-EFGH",
  prizeName: "スターバックスカード",
  username: "taro_jp",
  brandName: "ブランド",
};

export function renderDmPreview(template: string, values: DmPreviewValues): string {
  const source = template.trim().length > 0 ? template : DEFAULT_DM_TEMPLATE;
  return source
    .replaceAll("{{CODE}}", values.code)
    .replaceAll("{{PRIZE_NAME}}", values.prizeName)
    .replaceAll("{{USERNAME}}", values.username)
    .replaceAll("{{BRAND_NAME}}", values.brandName);
}

/**
 * 코드 자리가 빠졌는지 판정.
 * 빈 문구는 서버 기본 문구(= {{CODE}} 포함)가 쓰이므로 누락이 아니다.
 */
export function dmTemplateMissingCode(template: string | null): boolean {
  if (template === null || template.trim().length === 0) return false;
  return !template.includes("{{CODE}}");
}
