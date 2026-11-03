import type { Residence } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";

/** 거주지 라벨 키 — 목록 컬럼·필터 칩·CSV 가 같은 표기를 쓰도록 한 곳에 둔다. */
export const RESIDENCE_LABEL_KEY: Record<Residence, AdminTranslationKey> = {
  KR: "domains.influencer.residence.kr",
  JP: "domains.influencer.residence.jp",
  NONE: "domains.influencer.residence.none",
};

/** 필터·컬럼에 노출하는 순서. 한국 발송 캠페인이 잦아 한국을 앞에 둔다. */
export const RESIDENCE_ORDER: readonly Residence[] = ["KR", "JP", "NONE"];
