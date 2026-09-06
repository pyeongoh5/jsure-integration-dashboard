export * from './adminApi.js';
export * from './campaignReadiness.js';

/** JST(UTC+9) 기준 "YYYY-MM-DD" 문자열. 응모/포스트 매칭 키. */
export function dateJst(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** JST 날짜 + "HH:mm" 를 UTC Date로 변환 */
export function jstToUtc(yyyyMmDd: string, hhMm: string): Date {
  return new Date(`${yyyyMmDd}T${hhMm}:00+09:00`);
}

/** 응모 결과 API 응답 */
export type EntryResultResponse =
  | { result: 'lose' }
  | {
      result: 'win_pending';
      winnerId: string;
      prizeName: string;
      /** 검증 실패 사유 (재시도 안내용). 재시도는 당일 응모 화면에서만 (F-5.3) */
      failReason?: 'follow' | 'repost';
    }
  | {
      result: 'win_confirmed';
      winnerId: string;
      prizeName: string;
      prizeType: 'PHYSICAL' | 'CODE';
      /** PHYSICAL: 배송지 입력 폼으로 유도 */
      needsShipping: boolean;
    };

/** 브랜드 참여 LP 데이터 (GET /campaigns/:campaignSlug/brands/:brandSlug) */
export interface CampaignLp {
  /** 참여(BrandCampaign) id — 응모 API 가 받는 값 */
  brandCampaignId: string;
  /** 속한 시즌 */
  campaign: { name: string; slug: string };
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  xUsername: string | null;
  /** 기간은 시즌에서 온다 */
  startsAt: string;
  endsAt: string;
  /** 당일 캠페인 포스트 URL (리포스트 유도용). 미게시 시 null */
  todayPostUrl: string | null;
  prizeSummary: string;
  /** 트윗 링크 카드용 이미지 — LP 의 og:image 로 쓴다 */
  cardImageUrl: string | null;
  /** 이벤트 규칙 가이드 URL */
  rulesUrl: string | null;
  prUrl: string | null;
  winMediaUrl: string | null;
  loseMediaUrl: string | null;
}

/** 진행 중 시즌 목록 카드 (GET /campaigns) */
export interface CampaignSummary {
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** 참여 중(ACTIVE)인 브랜드 수 */
  brandCount: number;
}

/** 시즌 LP 데이터 (GET /campaigns/:campaignSlug) — 참여 브랜드 카드 목록 */
export interface CampaignSeasonLp {
  campaignId: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  brands: {
    brandCampaignId: string;
    brandName: string;
    brandSlug: string;
    brandLogoUrl: string | null;
    xUsername: string | null;
    prizeSummary: string;
  }[];
}

/** 당첨 히스토리 항목 (GET /me/wins) — 당첨 확정 건만 (F-3.6) */
export interface WinHistoryItem {
  winnerId: string;
  dateJst: string;
  prizeName: string;
  prizeType: 'PHYSICAL' | 'CODE';
  /** PHYSICAL: 배송지 미입력이고 캠페인 종료 전이면 true */
  needsShipping: boolean;
  /** PHYSICAL: 배송지 입력 완료 여부 */
  shippingEntered: boolean;
  /** CODE: DM 발송 완료 여부 */
  dmSent: boolean;
}
