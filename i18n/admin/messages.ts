export const adminMessages = {
  common: {
    languageName: { ko: "한국어", en: "English", ja: "日本語" },
    cancel: { ko: "취소", en: "Cancel", ja: "キャンセル" },
    roles: {
      guest: { ko: "게스트", en: "Guest", ja: "ゲスト" },
      admin: { ko: "Admin", en: "Admin", ja: "Admin" },
      owner: { ko: "Owner", en: "Owner", ja: "Owner" },
    },
  },
  nav: {
    groups: {
      operations: { ko: "운영", en: "Operations", ja: "運営" },
      customers: { ko: "고객", en: "Customers", ja: "顧客" },
      finance: { ko: "재무", en: "Finance", ja: "財務" },
      system: { ko: "시스템", en: "System", ja: "システム" },
    },
    items: {
      dashboard: { ko: "대시보드", en: "Dashboard", ja: "ダッシュボード" },
      campaigns: { ko: "캠페인 관리", en: "Campaigns", ja: "キャンペーン管理" },
      applicants: { ko: "응모자 관리", en: "Applicants", ja: "応募者管理" },
      drafts: { ko: "검토", en: "Reviews", ja: "レビュー" },
      influencers: { ko: "인플루언서", en: "Influencers", ja: "インフルエンサー" },
      payouts: { ko: "정산 관리", en: "Payouts", ja: "精算管理" },
      reports: { ko: "리포트", en: "Reports", ja: "レポート" },
      notices: { ko: "공지사항", en: "Notices", ja: "お知らせ" },
      messageTemplates: { ko: "메시지 템플릿", en: "Message Templates", ja: "メッセージテンプレート" },
      team: { ko: "팀원/권한", en: "Team & Roles", ja: "チーム・権限" },
    },
  },
  sidebar: {
    footer: {
      guest: { ko: "게스트", en: "Guest", ja: "ゲスト" },
      loginRequired: { ko: "로그인이 필요합니다", en: "Login required", ja: "ログインが必要です" },
      logout: { ko: "로그아웃", en: "Log out", ja: "ログアウト" },
      logoutConfirmTitle: {
        ko: "로그아웃 하시겠습니까?",
        en: "Log out?",
        ja: "ログアウトしますか？",
      },
      logoutConfirmSubtitle: {
        ko: "현재 기기에서 세션이 종료되며, 다시 사용하려면 로그인이 필요합니다.",
        en: "Your session on this device will end. You will need to log in again to continue.",
        ja: "この端末のセッションが終了します。再度利用するにはログインが必要です。",
      },
    },
  },
} as const;
