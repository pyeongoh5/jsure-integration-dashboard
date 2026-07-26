export * from './adminApi';

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

/** 단독 LP 데이터 (GET /campaigns/:slug) */
export interface CampaignLp {
  campaignId: string;
  slug: string;
  brandName: string;
  xUsername: string | null;
  startsAt: string;
  endsAt: string;
  /** 당일 캠페인 포스트 URL (리포스트 유도용). 미게시 시 null */
  todayPostUrl: string | null;
  prizeSummary: string;
  prUrl: string | null;
  winMediaUrl: string | null;
  loseMediaUrl: string | null;
}

/** 진행 중 캠페인 목록 카드 (GET /campaigns) */
export interface CampaignSummary {
  slug: string;
  brandName: string;
  xUsername: string | null;
  endsAt: string;
  prizeSummary: string;
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
