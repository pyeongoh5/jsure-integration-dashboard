import { describe, expect, it } from "vitest";
import type { AdminTranslationKey } from "@i18n/admin";
import { likertLabel } from "./answerDisplay";

/** 키와 파라미터를 그대로 돌려줘 어느 키를 어떤 값으로 읽었는지 단언할 수 있게 한다. */
const identityTranslate = (
  key: AdminTranslationKey,
  params?: Record<string, string | number>,
) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe("likertLabel", () => {
  it("프리셋(AGREEMENT)은 단계별 i18n 키를 읽는다", () => {
    expect(likertLabel({ preset: "AGREEMENT" }, 1, identityTranslate)).toBe(
      "builderSurveys.likert.AGREEMENT.step1",
    );
    expect(likertLabel({ preset: "AGREEMENT" }, 5, identityTranslate)).toBe(
      "builderSurveys.likert.AGREEMENT.step5",
    );
  });

  it("CUSTOM 은 저장된 라벨을 그대로 읽는다(i18n 거치지 않음)", () => {
    const scale = { preset: "CUSTOM" as const, labels: ["별로", "보통", "최고"] };
    expect(likertLabel(scale, 1, identityTranslate)).toBe("별로");
    expect(likertLabel(scale, 3, identityTranslate)).toBe("최고");
  });

  it("NUMERIC 은 모든 단계를 점수로 표기한다", () => {
    const scale = { preset: "NUMERIC" as const };
    expect(likertLabel(scale, 1, identityTranslate)).toBe(
      'builderSurveys.likert.NUMERIC.point:{"step":1}',
    );
    expect(likertLabel(scale, 3, identityTranslate)).toBe(
      'builderSurveys.likert.NUMERIC.point:{"step":3}',
    );
    expect(likertLabel(scale, 5, identityTranslate)).toBe(
      'builderSurveys.likert.NUMERIC.point:{"step":5}',
    );
  });

  it("범위 밖 단계는 빈 문자열", () => {
    expect(likertLabel({ preset: "AGREEMENT" }, 0, identityTranslate)).toBe("");
    expect(likertLabel({ preset: "AGREEMENT" }, 6, identityTranslate)).toBe("");
    const custom = { preset: "CUSTOM" as const, labels: ["가", "나"] };
    expect(likertLabel(custom, 3, identityTranslate)).toBe("");
  });
});
