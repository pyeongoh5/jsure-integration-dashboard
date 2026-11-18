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

const LIKERT_NUMERIC_MIN_KEY: AdminTranslationKey = "builderSurveys.likert.NUMERIC.min";
const LIKERT_NUMERIC_MAX_KEY: AdminTranslationKey = "builderSurveys.likert.NUMERIC.max";

/**
 * 리커트 척도 단계(1-based)의 표시 라벨. 프리셋은 `translateLabel`(어드민 i18n) 로,
 * CUSTOM 은 설문 작성 시 운영자가 입력한 라벨을 그대로 읽는다.
 *
 * NUMERIC 프리셋은 양 끝(최소/최대)만 라벨이 있고 중간 단계는 숫자만 쓰므로 빈 문자열을
 * 돌려준다. 범위를 벗어난 step 도 빈 문자열 — 호출부가 숫자만 보여줄 수 있게.
 *
 * Task 8(캠페인 리포트 엑셀)이 같은 변환을 그대로 가져다 쓴다 — 화면과 엑셀의 라벨이
 * 갈라지지 않도록 이 함수 하나로 고정한다.
 */
export function likertLabel(
  scale: LikertScale,
  step: number,
  translateLabel: (key: AdminTranslationKey) => string,
): string {
  if (step < 1 || step > likertStepCount(scale)) return "";
  if (scale.preset === "CUSTOM") {
    return scale.labels[step - 1] ?? "";
  }
  if (scale.preset === "NUMERIC") {
    if (step === 1) return translateLabel(LIKERT_NUMERIC_MIN_KEY);
    if (step === likertStepCount(scale)) return translateLabel(LIKERT_NUMERIC_MAX_KEY);
    return "";
  }
  const key = LIKERT_PRESET_STEP_KEYS[scale.preset][step - 1];
  return key ? translateLabel(key) : "";
}
