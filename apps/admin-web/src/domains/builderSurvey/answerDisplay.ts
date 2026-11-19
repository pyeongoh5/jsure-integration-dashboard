import type { SurveyQuestion } from "@jsure/shared";
import { likertStepCount } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";

type LikertScale = Extract<SurveyQuestion, { type: "LIKERT" }>["scale"];
type LikertPresetWithStepLabels = Exclude<LikertScale["preset"], "NUMERIC" | "CUSTOM">;

const LIKERT_PRESET_STEP_KEYS: Record<
  LikertPresetWithStepLabels,
  readonly AdminTranslationKey[]
> = {
  AGREEMENT: [
    "builderSurveys.likert.AGREEMENT.step1",
    "builderSurveys.likert.AGREEMENT.step2",
    "builderSurveys.likert.AGREEMENT.step3",
    "builderSurveys.likert.AGREEMENT.step4",
    "builderSurveys.likert.AGREEMENT.step5",
  ],
  SATISFACTION: [
    "builderSurveys.likert.SATISFACTION.step1",
    "builderSurveys.likert.SATISFACTION.step2",
    "builderSurveys.likert.SATISFACTION.step3",
    "builderSurveys.likert.SATISFACTION.step4",
    "builderSurveys.likert.SATISFACTION.step5",
  ],
  FREQUENCY: [
    "builderSurveys.likert.FREQUENCY.step1",
    "builderSurveys.likert.FREQUENCY.step2",
    "builderSurveys.likert.FREQUENCY.step3",
    "builderSurveys.likert.FREQUENCY.step4",
    "builderSurveys.likert.FREQUENCY.step5",
  ],
};

const LIKERT_NUMERIC_POINT_KEY: AdminTranslationKey = "builderSurveys.likert.NUMERIC.point";

/**
 * 리커트 척도 단계(1-based)의 표시 라벨. 프리셋은 `translateLabel`(어드민 i18n) 로,
 * CUSTOM 은 설문 작성 시 운영자가 입력한 라벨을 그대로 읽는다.
 *
 * NUMERIC 프리셋은 단계마다 점수로 표기한다 — `1점`, `2점` … 범위를 벗어난 step 만
 * 빈 문자열이다.
 *
 * 캠페인 리포트 엑셀이 같은 변환을 그대로 가져다 쓴다 — 화면과 엑셀의 라벨이
 * 갈라지지 않도록 이 함수 하나로 고정한다.
 */
export function likertLabel(
  scale: LikertScale,
  step: number,
  translateLabel: (
    key: AdminTranslationKey,
    params?: Record<string, string | number>,
  ) => string,
): string {
  if (step < 1 || step > likertStepCount(scale)) return "";
  if (scale.preset === "CUSTOM") {
    return scale.labels[step - 1] ?? "";
  }
  if (scale.preset === "NUMERIC") {
    return translateLabel(LIKERT_NUMERIC_POINT_KEY, { step });
  }
  const key = LIKERT_PRESET_STEP_KEYS[scale.preset][step - 1];
  return key ? translateLabel(key) : "";
}
