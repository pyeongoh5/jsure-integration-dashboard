export * from './adminApi.js';
export * from './campaignReadiness.js';
export * from './mediaFormat.js';

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

/**
 * 오늘(JST) 응모 상태 (GET /brand-campaigns/:id/entries/today).
 * 화면 재진입·새로고침 시 당첨 후보(검증 대기) 상태를 복구하는 데 쓴다 —
 * 이게 없으면 응모 버튼이 409 "응모 완료"만 보여줘 검증 재시도 입구가 사라진다.
 */
export type TodayEntryResponse = { entered: false } | ({ entered: true } & EntryResultResponse);

/** 브랜드 참여 LP 데이터 (GET /campaigns/:campaignSlug/brands/:brandSlug) */
export interface CampaignLp {
  /** 참여(BrandCampaign) id — 응모 API 가 받는 값 */
  brandCampaignId: string;
  /** 속한 시즌 */
  campaign: {
    name: string;
    slug: string;
    /** 시즌 LP 유도 배너 썸네일 — 응모 페이지 하단에 노출 */
    thumbnailUrl: string | null;
  };
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  xUsername: string | null;
  /** 기간은 시즌에서 온다 */
  startsAt: string;
  endsAt: string;
  /** 당일 캠페인 포스트 URL (리포스트 유도용). 미게시 시 null */
  todayPostUrl: string | null;
  /** 매일 게시 시각 (JST "HH:mm") — 게시 전 안내 문구용 */
  dailyPostTime: string;
  /** 당일 게시물(없으면 유효 소재)의 첫 번째 이미지 — 응모 화면 상단에 보여준다 */
  postImageUrl: string | null;
  prizeSummary: string;
  /** 경품 목록 (티어순) — 규칙 페이지의 경품 항목 렌더용 */
  prizes: { name: string; totalQty: number }[];
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
  /** 시즌 LP 상단 키비주얼 */
  keyVisualUrl: string | null;
  /** 브랜드 목록 영역의 배경 이미지 */
  listBackgroundUrl: string | null;
  brands: {
    brandCampaignId: string;
    brandName: string;
    brandSlug: string;
    brandLogoUrl: string | null;
    xUsername: string | null;
    /** 카드 썸네일 — 현재 유효한 포스트 소재의 첫 번째 이미지 */
    postImageUrl: string | null;
    /** 가장 최근 게시된 캠페인 포스트 URL — 카드 클릭 시 이동 대상. 없으면 참여 LP 로 폴백 */
    latestPostUrl: string | null;
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
