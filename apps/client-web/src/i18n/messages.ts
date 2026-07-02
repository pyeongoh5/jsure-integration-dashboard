export const messages = {
  components: {
    bottomTab: {
      search: { ja: "探す", ko: "찾기" },
      applications: { ja: "応募内訳", ko: "지원 내역" },
      notices: { ja: "お知らせ", ko: "알림" },
      myPage: { ja: "マイページ", ko: "마이페이지" },
    },
    wizardFooter: {
      next: { ja: "次へ", ko: "다음" },
      back: { ja: "戻る", ko: "뒤로" },
      submitting: { ja: "送信中…", ko: "전송 중…" },
    },
    formField: {
      defaultError: { ja: "入力内容を確認してください", ko: "입력 내용을 확인해 주세요" },
    },
    pageHeader: {
      backAriaLabel: { ja: "戻る", ko: "뒤로" },
    },
  },
  auth: {
    terms: {
      agreeAll: { ja: "すべての項目に同意します", ko: "모든 항목에 동의합니다" },
      uncheckAriaLabel: { ja: "解除", ko: "해제" },
      checkAriaLabel: { ja: "同意", ko: "동의" },
      requiredTag: { ja: "[必須]", ko: "[필수]" },
    },
    snsAccount: {
      followerCount: { ja: "フォロワー数", ko: "팔로워 수" },
    },
  },
  campaign: {
    card: {
      ended: { ja: "終了", ko: "종료" },
      followerLabel: { ja: "フォロワー", ko: "팔로워" },
      subscriberLabel: { ja: "登録者", ko: "구독자" },
      instagramFeed: { ja: "フィード", ko: "피드" },
      instagramReels: { ja: "リール", ko: "릴스" },
      followerMinSuffix: { ja: "人以上", ko: "명 이상" },
      noLimit: { ja: "制限なし", ko: "제한 없음" },
      yenSuffix: { ja: "円", ko: "엔" },
      recruitPrefix: { ja: "募集", ko: "모집" },
      peopleSuffix: { ja: "名", ko: "명" },
    },
  },
} as const;
