import type { ConsentItem } from "../types/influencer.js";

export const INFLUENCER_TERMS_VERSION = "2026-07-14";

export interface InfluencerTerm {
  key: ConsentItem;
  title: string;
  bodyJa: string;
  bodyKo: string;
}

export const INFLUENCER_TERMS: ReadonlyArray<InfluencerTerm> = [
  {
    key: "PR_LABEL",
    title: "PR表記について",
    bodyJa:
      "投稿の冒頭に「#PR」または「ブランドから提供いただきました」という文言を必ず記載することに同意しますか？",
    bodyKo:
      "게시물 첫 부분에 「#PR」 또는 「브랜드로부터 제공받았습니다」 문구 기재에 동의하시나요？",
  },
  {
    key: "DEADLINE",
    title: "投稿期限について",
    bodyJa: "各キャンペーンで定められた投稿期限を遵守いただけますか？",
    bodyKo: "각 캠페인에서 정한 게시 기한을 준수하실 수 있나요？",
  },
  {
    key: "INSIGHTS",
    title: "インサイトデータの提出について",
    bodyJa:
      "投稿から7日後に、インサイト画面のスクリーンショット（保存数・リーチ数・プロフィール表示数等）を提出いただけますか？",
    bodyKo:
      "게시 후 7일 뒤, 인사이트 화면 캡처（저장 수・도달 수・프로필 노출 수 등）를 제출해 주실 수 있나요？",
  },
  {
    key: "SECONDARY_USE",
    title: "二次利用・データ提供への同意について",
    bodyJa:
      "投稿いただいた写真や動画のブランドによる二次利用、およびデータ提供に同意いただけますか？",
    bodyKo:
      "게시하신 사진・영상의 브랜드 2차 활용 및 데이터 제공에 동의하시나요？",
  },
  {
    key: "YAKKIHO",
    title: "薬機法の遵守について",
    bodyJa:
      "薬機法を遵守し、断定的・誇張的な表現を控えることに同意いただけますか？",
    bodyKo:
      "약기법을 준수하고, 단정적・과장된 표현을 삼가는 것에 동의하시나요？",
  },
  {
    key: "GUIDELINE",
    title: "ガイドラインの確認・遵守について",
    bodyJa:
      "必須ハッシュタグ等のガイドラインをご確認いただき、遵守いただけますか？",
    bodyKo: "필수 해시태그 등 가이드라인을 확인하시고, 준수해 주실 수 있나요？",
  },
];
