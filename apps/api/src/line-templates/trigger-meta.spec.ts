import { LineTriggerKeySchema, isCommonLineTriggerKey } from "@jsure/shared";
import { COMMON_TRIGGER_META, publicVariables, TRIGGER_META } from "./trigger-meta";

const ALL_TRIGGERS = LineTriggerKeySchema.options;
/** 공통 트리거는 응모가 없어 캠페인 변수를 가질 수 없다. */
const CAMPAIGN_TRIGGERS = ALL_TRIGGERS.filter(
  (triggerKey) => !isCommonLineTriggerKey(triggerKey),
);

describe("트리거 변수 목록", () => {
  it("모든 캠페인 트리거에서 참여 서브타입을 쓸 수 있다", () => {
    const missing = CAMPAIGN_TRIGGERS.filter(
      (triggerKey) =>
        !publicVariables(triggerKey).some(
          (variable) => variable.key === "subType",
        ),
    );
    expect(missing).toEqual([]);
  });

  it("공통 트리거는 모두 COMMON 탭에 속한다", () => {
    for (const [triggerKey, meta] of Object.entries(COMMON_TRIGGER_META)) {
      expect(meta.category).toBe("COMMON");
      expect(isCommonLineTriggerKey(triggerKey as never)).toBe(true);
    }
  });

  it("탈퇴 반려 트리거만 반려 사유 변수를 제공한다", () => {
    const keysOf = (triggerKey: "COMMON_WITHDRAWAL_APPROVED" | "COMMON_WITHDRAWAL_REJECTED") =>
      publicVariables(triggerKey).map((variable) => variable.key);
    expect(keysOf("COMMON_WITHDRAWAL_REJECTED")).toContain("rejectReason");
    expect(keysOf("COMMON_WITHDRAWAL_APPROVED")).not.toContain("rejectReason");
  });

  it("변수 키가 트리거 안에서 중복되지 않는다", () => {
    // 공통 변수로 올린 뒤 개별 나열이 남아 있으면 어드민 패널에 두 번 보인다.
    for (const triggerKey of ALL_TRIGGERS) {
      const keys = publicVariables(triggerKey).map((variable) => variable.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("반려 리마인더는 최종 기한 변수를 제공한다", () => {
    for (const triggerKey of [
      "SNS_POST_REJECTION_REMINDER",
      "SIMPLE_REVIEW_REJECTION_REMINDER",
    ] as const) {
      expect(
        publicVariables(triggerKey).map((variable) => variable.key),
      ).toContain("finalDeadline");
    }
  });
});

describe("서브타입 변수 렌더", () => {
  const resolverFor = (key: string) =>
    TRIGGER_META.SNS_APPLICATION_APPROVED.variables.find(
      (variable) => variable.key === key,
    )!.resolver;

  function context(
    subTypes: string[],
    options: { subType: string; option: string }[],
  ) {
    return { application: { subTypes, options } } as never;
  }

  it("옵션이 있는 서브타입은 투고 타입을 괄호로 붙인다", () => {
    expect(
      resolverFor("subTypeWithOption")(
        context(["INSTAGRAM"], [{ subType: "INSTAGRAM", option: "REELS" }]),
      ),
    ).toBe("Instagram（リール）");
  });

  it("옵션이 없는 서브타입은 플랫폼명만 낸다", () => {
    expect(resolverFor("subTypeWithOption")(context(["TIKTOK"], []))).toBe(
      "TikTok",
    );
  });

  it("여러 서브타입은 중점으로 이어 붙인다", () => {
    expect(
      resolverFor("subTypeWithOption")(
        context(
          ["INSTAGRAM", "TIKTOK"],
          [{ subType: "INSTAGRAM", option: "FEED" }],
        ),
      ),
    ).toBe("Instagram（フィード）・TikTok");
  });

  it("기존 subType 변수는 옵션 없이 플랫폼만 낸다", () => {
    expect(
      resolverFor("subType")(
        context(["INSTAGRAM"], [{ subType: "INSTAGRAM", option: "REELS" }]),
      ),
    ).toBe("Instagram");
  });
});
