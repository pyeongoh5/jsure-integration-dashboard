import { postTemplateCoverage, dmTemplateMissingCode } from '@jsure/jwin-shared';
import { brandAccountStatus } from './adminMappers';

/**
 * `SETUP → ACTIVE` 전환 서버 검증.
 *
 * 화면(admin-web `activationChecklist.ts`)이 같은 4게이트를 미리 보여주지만,
 * 그건 UX 이고 이쪽이 최종 방어선이다. 화면을 거치지 않는 호출이나 화면 버그로
 * 미비된 캠페인이 ACTIVE 가 되면, 그 뒤로는 매일 게시가 조용히 실패한다.
 *
 * 커버리지·DM 코드 판정은 화면과 **같은 함수**(@jsure/jwin-shared)를 쓴다.
 */

type ActivationAccount = {
  xUserId: string | null;
  encryptedAccessToken: string | null;
  refreshFailedAt: Date | null;
};

export type ActivationInput = {
  campaign: { startsAt: Date; endsAt: Date; dmTemplate: string | null };
  brandAccount: ActivationAccount | null;
  prizes: { type: 'PHYSICAL' | 'CODE' }[];
  postTemplates: { activeFrom: Date; activeTo: Date }[];
};

/** 미충족 사유(한국어). 빈 배열이면 전환 가능. */
export function activationBlockers(input: ActivationInput): string[] {
  const blockers: string[] = [];

  if (!input.brandAccount) {
    blockers.push('브랜드 계정이 연결되지 않았습니다');
  } else if (brandAccountStatus(input.brandAccount) !== 'CONNECTED') {
    blockers.push('브랜드 계정 연동이 완료되지 않았습니다');
  }

  if (input.prizes.length === 0) {
    blockers.push('경품이 1건도 등록되지 않았습니다');
  }

  const coverage = postTemplateCoverage(
    {
      startsAt: input.campaign.startsAt.toISOString(),
      endsAt: input.campaign.endsAt.toISOString(),
    },
    input.postTemplates.map((template) => ({
      activeFrom: template.activeFrom.toISOString(),
      activeTo: template.activeTo.toISOString(),
    })),
  );
  if (coverage.postingDates.length === 0) {
    blockers.push('게시 예정일이 없습니다. 캠페인 기간을 확인하세요');
  } else if (coverage.gaps.length > 0) {
    const days = coverage.gaps
      .map((gap) =>
        gap.fromDateJst === gap.toDateJst
          ? gap.fromDateJst
          : `${gap.fromDateJst}~${gap.toDateJst}`,
      )
      .join(', ');
    blockers.push(`소재가 없는 날이 있습니다: ${days}`);
  }

  const hasCodePrize = input.prizes.some((prize) => prize.type === 'CODE');
  if (hasCodePrize && dmTemplateMissingCode(input.campaign.dmTemplate)) {
    blockers.push('CODE 경품이 있으면 당첨 DM 문구에 {{CODE}}가 있어야 합니다');
  }

  return blockers;
}
