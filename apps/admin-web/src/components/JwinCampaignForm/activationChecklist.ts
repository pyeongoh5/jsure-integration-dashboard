import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminCampaignDetail, AdminPrize } from "@/domains/jwin";
import { dmTemplateMissingCode } from "./dmTemplatePreview";
import { formatCoverageGaps, type PostTemplateCoverage } from "./postTemplateCoverage";

/**
 * SETUP → ACTIVE 발행 전 체크리스트 (설계 §3 상태 전환).
 * 4항목을 전부 충족해야 전환 버튼이 열린다. 여기서 놓치면 미비된 캠페인이 ACTIVE 로
 * 올라가 매일 게시가 조용히 실패한다.
 *
 * 순수 함수라 문자열을 만들지 않는다 — 번역 키와 파라미터만 돌려주고 렌더는 화면이 한다.
 */

export type ActivationCheckKey = "account" | "prize" | "coverage" | "dmCode";

export type ActivationCheck = {
  key: ActivationCheckKey;
  labelKey: AdminTranslationKey;
  ok: boolean;
  /** 미충족 사유의 번역 키. 충족이면 null */
  reasonKey: AdminTranslationKey | null;
  /** 사유 문구에 넣을 치환값 */
  reasonParams?: Record<string, string | number>;
};

function accountCheck(detail: AdminCampaignDetail): ActivationCheck {
  const labelKey: AdminTranslationKey = "jwin.checklist.account";
  if (!detail.brandAccountId || !detail.brandAccount) {
    return { key: "account", labelKey, ok: false, reasonKey: "jwin.checklist.accountNotSelected" };
  }
  if (detail.brandAccount.status !== "CONNECTED") {
    return { key: "account", labelKey, ok: false, reasonKey: "jwin.checklist.accountNotConnected" };
  }
  return { key: "account", labelKey, ok: true, reasonKey: null };
}

function prizeCheck(prizes: AdminPrize[]): ActivationCheck {
  const labelKey: AdminTranslationKey = "jwin.checklist.prize";
  if (prizes.length === 0) {
    return { key: "prize", labelKey, ok: false, reasonKey: "jwin.checklist.prizeEmpty" };
  }
  return { key: "prize", labelKey, ok: true, reasonKey: null };
}

function coverageCheck(coverage: PostTemplateCoverage): ActivationCheck {
  const labelKey: AdminTranslationKey = "jwin.checklist.coverage";
  if (coverage.postingDates.length === 0) {
    return {
      key: "coverage",
      labelKey,
      ok: false,
      reasonKey: "jwin.checklist.coverageNoPostingDates",
    };
  }
  if (coverage.gaps.length > 0) {
    return {
      key: "coverage",
      labelKey,
      ok: false,
      reasonKey: "jwin.checklist.coverageGaps",
      reasonParams: { gaps: formatCoverageGaps(coverage.gaps) },
    };
  }
  return { key: "coverage", labelKey, ok: true, reasonKey: null };
}

function dmCodeCheck(prizes: AdminPrize[], dmTemplate: string | null): ActivationCheck {
  const labelKey: AdminTranslationKey = "jwin.checklist.dmCode";
  const hasCodePrize = prizes.some((prize) => prize.type === "CODE");
  if (!hasCodePrize || !dmTemplateMissingCode(dmTemplate)) {
    return { key: "dmCode", labelKey, ok: true, reasonKey: null };
  }
  return { key: "dmCode", labelKey, ok: false, reasonKey: "jwin.checklist.dmCodeMissing" };
}

export function activationChecklist(input: {
  detail: AdminCampaignDetail;
  prizes: AdminPrize[];
  coverage: PostTemplateCoverage;
}): ActivationCheck[] {
  return [
    accountCheck(input.detail),
    prizeCheck(input.prizes),
    coverageCheck(input.coverage),
    dmCodeCheck(input.prizes, input.detail.dmTemplate),
  ];
}

export function canActivate(checks: ActivationCheck[]): boolean {
  return checks.every((check) => check.ok);
}
