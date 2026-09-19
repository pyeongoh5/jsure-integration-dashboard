import {
  postTemplateCoverage,
  dmTemplateMissingCode,
  sniffMediaFormat,
  X_POSTABLE_FORMATS,
} from '@jsure/jwin-shared';
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
  /** startsAt/endsAt 은 시즌(Campaign), dmTemplate 은 참여(BrandCampaign) 에서 온다. */
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

/**
 * 같은 PATCH 요청이 `brandAccountId` 와 `status: 'ACTIVE'` 를 함께 보낼 수 있으므로,
 * 검증에 쓸 계정은 저장된 값이 아니라 요청이 의도하는 값이어야 한다.
 *
 * - 필드 자체가 없으면(undefined) 저장된 계정을 그대로 쓴다.
 * - 명시적 null 이면 "연결 해제" 의도이므로 계정 없음으로 취급한다.
 * - 저장된 계정과 같은 id 면 이미 가진 값을 재사용한다(중복 조회 방지).
 * - 그 외에는 새로 조회한 계정(`fetchedAccount`)을 쓴다 — 호출부가 미리 조회해서 넘긴다.
 */
export function resolveAccountForActivationCheck<Account>(
  incomingBrandAccountId: string | null | undefined,
  current: { brandAccountId: string | null; brandAccount: Account | null },
  fetchedAccount: Account | null,
): Account | null {
  if (incomingBrandAccountId === undefined) return current.brandAccount;
  if (incomingBrandAccountId === null) return null;
  if (incomingBrandAccountId === current.brandAccountId) return current.brandAccount;
  return fetchedAccount;
}

/** 매직 바이트 판별에는 앞 16바이트면 충분하다 — 전체 다운로드를 피한다. */
async function fetchHeadBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-15' } });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: number[] = [];
    while (chunks.length < 16) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(...value.subarray(0, 16 - chunks.length));
    }
    await reader.cancel().catch(() => {});
    return Uint8Array.from(chunks);
  } catch {
    return null;
  }
}

/**
 * 발행 전 소재 미디어 실물 검사 (게이트 ⑤).
 *
 * 업로드 검증은 새 파일만 막는다 — 검증 도입 전에 등록된 소재나 확장자를 속인
 * 파일(.png 탈을 쓴 AVIF, 2026-09-19 운영 실측)은 게시 시점에야 X 가 400 으로
 * 거부해 매일 게시가 조용히 실패한다. ACTIVE 전환 때 실제 바이트를 확인한다.
 */
export async function mediaFormatBlockers(
  postTemplates: { label: string; mediaUrls: string[] }[],
): Promise<string[]> {
  const blockers: string[] = [];
  for (const template of postTemplates) {
    for (const mediaUrl of template.mediaUrls) {
      const head = await fetchHeadBytes(mediaUrl);
      if (!head) {
        blockers.push(`소재 "${template.label}"의 미디어를 가져올 수 없습니다: ${mediaUrl}`);
        continue;
      }
      const format = sniffMediaFormat(head);
      if (format === 'unknown' || !X_POSTABLE_FORMATS.includes(format)) {
        blockers.push(
          `소재 "${template.label}"에 X 가 지원하지 않는 형식(${format})의 미디어가 있습니다 — PNG/JPEG/WEBP/MP4 로 다시 업로드하세요`,
        );
      }
    }
  }
  return blockers;
}
