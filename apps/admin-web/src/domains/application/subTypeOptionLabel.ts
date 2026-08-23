import { SUB_TYPE_OPTION_LABEL } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";

type TranslateLabel = (key: AdminTranslationKey) => string;

const OPTION_LABEL_KEY: Record<string, AdminTranslationKey> = {
  FEED: "domains.application.subTypeOption.feed",
  REELS: "domains.application.subTypeOption.reels",
};

/** 서브타입 옵션 라벨 — FEED/REELS 는 언어별 번역, 그 외는 공용 라벨(브랜드명) 폴백. */
export function subTypeOptionLabel(
  option: string,
  translateLabel: TranslateLabel,
): string {
  const labelKey = OPTION_LABEL_KEY[option];
  return labelKey
    ? translateLabel(labelKey)
    : (SUB_TYPE_OPTION_LABEL[option] ?? option);
}
