import { describe, expect, it } from "vitest";
import { activationChecklist, canActivate, type ActivationCheck } from "./activationChecklist";
import type { PostTemplateCoverage } from "./postTemplateCoverage";
import type { AdminBrandAccount, AdminCampaignDetail, AdminPrize } from "@/domains/jwin";

const CONNECTED_ACCOUNT: AdminBrandAccount = {
  id: "acct-1",
  label: "브랜드 공식",
  xUserId: "1234",
  xUsername: "devsure5",
  status: "CONNECTED",
  refreshFailCount: 0,
  accessTokenExpiresAt: null,
  campaignCount: 1,
  connectUrl: "https://example.test/connect?accountId=acct-1",
};

const BASE_DETAIL: AdminCampaignDetail = {
  id: "camp-1",
  brandName: "브랜드",
  slug: "brand-2026",
  status: "SETUP",
  startsAt: "2026-08-31T15:00:00.000Z",
  endsAt: "2026-09-05T14:59:00.000Z",
  dailyPostTime: "11:00",
  dailyWinCap: null,
  cardImageUrl: null,
  rulesUrl: null,
  prUrl: null,
  winMediaUrl: null,
  loseMediaUrl: null,
  dmTemplate: null,
  brandAccountId: "acct-1",
  brandAccount: CONNECTED_ACCOUNT,
};

const CODE_PRIZE: AdminPrize = {
  id: "prize-1",
  type: "CODE",
  name: "기프트카드",
  tier: 1,
  totalQty: 10,
  remainingQty: 10,
  winProbability: 0.1,
  availableCodeCount: 10,
};

const PHYSICAL_PRIZE: AdminPrize = {
  ...CODE_PRIZE,
  id: "prize-2",
  type: "PHYSICAL",
  availableCodeCount: 0,
};

const FULL_COVERAGE: PostTemplateCoverage = {
  postingDates: ["2026-09-01", "2026-09-02"],
  gaps: [],
};

function checkOf(checks: ActivationCheck[], key: string): ActivationCheck {
  const found = checks.find((check) => check.key === key);
  if (!found) throw new Error(`체크 항목 없음: ${key}`);
  return found;
}

describe("activationChecklist", () => {
  it("모두 충족하면 4항목 전부 ok이고 사유가 없다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checks).toHaveLength(4);
    expect(canActivate(checks)).toBe(true);
    expect(checks.every((check) => check.reasonKey === null)).toBe(true);
  });

  it("라벨은 번역 키로 돌려준다(문자열 하드코딩 금지)", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checks.map((check) => check.labelKey)).toEqual([
      "jwin.checklist.account",
      "jwin.checklist.prize",
      "jwin.checklist.coverage",
      "jwin.checklist.dmCode",
    ]);
  });

  it("계정 미선택은 사유 키를 알려준다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, brandAccountId: null, brandAccount: null },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "account").ok).toBe(false);
    expect(checkOf(checks, "account").reasonKey).toBe("jwin.checklist.accountNotSelected");
    expect(canActivate(checks)).toBe(false);
  });

  it("계정이 재연동 필요 상태면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: {
        ...BASE_DETAIL,
        brandAccount: { ...CONNECTED_ACCOUNT, status: "NEEDS_RECONNECT" },
      },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "account").ok).toBe(false);
    expect(checkOf(checks, "account").reasonKey).toBe("jwin.checklist.accountNotConnected");
  });

  it("경품이 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "prize").ok).toBe(false);
    expect(checkOf(checks, "prize").reasonKey).toBe("jwin.checklist.prizeEmpty");
    expect(canActivate(checks)).toBe(false);
  });

  it("소재 빈틈이 있으면 어느 날인지 파라미터로 넘긴다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: {
        postingDates: ["2026-09-01", "2026-09-02", "2026-09-03"],
        gaps: [{ fromDateJst: "2026-09-02", toDateJst: "2026-09-03" }],
      },
    });
    const coverage = checkOf(checks, "coverage");
    expect(coverage.ok).toBe(false);
    expect(coverage.reasonKey).toBe("jwin.checklist.coverageGaps");
    expect(coverage.reasonParams).toEqual({ gaps: "9/2 ~ 9/3" });
  });

  it("게시 예정일이 아예 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: { postingDates: [], gaps: [] },
    });
    expect(checkOf(checks, "coverage").ok).toBe(false);
    expect(checkOf(checks, "coverage").reasonKey).toBe("jwin.checklist.coverageNoPostingDates");
  });

  it("CODE 경품이 있는데 DM 문구에 코드 자리가 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: "おめでとうございます！" },
      prizes: [CODE_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(false);
    expect(checkOf(checks, "dmCode").reasonKey).toBe("jwin.checklist.dmCodeMissing");
    expect(canActivate(checks)).toBe(false);
  });

  it("CODE 경품이 있어도 DM 문구가 비어 있으면 서버 기본 문구가 쓰이므로 통과한다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: null },
      prizes: [CODE_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(true);
  });

  it("PHYSICAL 경품만 있으면 DM 문구를 검사하지 않는다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: "코드 없는 문구" },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(true);
  });
});
