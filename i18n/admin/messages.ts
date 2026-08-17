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
  components: {
    spinner: {
      loading: { ko: "로딩 중", en: "Loading", ja: "読み込み中" },
    },
    confirmDialog: {
      confirm: { ko: "확인", en: "OK", ja: "確認" },
      processing: { ko: "처리 중...", en: "Processing...", ja: "処理中..." },
    },
    richTextEditor: {
      bold: { ko: "굵게", en: "Bold", ja: "太字" },
      italic: { ko: "기울임", en: "Italic", ja: "斜体" },
      strikethrough: { ko: "취소선", en: "Strikethrough", ja: "取り消し線" },
      bulletList: { ko: "• 목록", en: "• List", ja: "• リスト" },
      orderedList: { ko: "1. 목록", en: "1. List", ja: "1. リスト" },
      blockquote: { ko: "인용", en: "Quote", ja: "引用" },
      textColor: { ko: "글자 색", en: "Text color", ja: "文字色" },
      alignLeft: { ko: "좌", en: "Left", ja: "左" },
      alignCenter: { ko: "중", en: "Center", ja: "中央" },
      alignRight: { ko: "우", en: "Right", ja: "右" },
      link: { ko: "링크", en: "Link", ja: "リンク" },
      linkUrlPrompt: { ko: "링크 URL", en: "Link URL", ja: "リンクURL" },
      image: { ko: "이미지", en: "Image", ja: "画像" },
      imageUploadFailed: {
        ko: "이미지 업로드에 실패했습니다",
        en: "Image upload failed",
        ja: "画像のアップロードに失敗しました",
      },
      widthPlaceholder: { ko: "예: 300", en: "e.g. 300", ja: "例: 300" },
      widthInPixelsTitle: {
        ko: "픽셀(px) 단위 너비",
        en: "Width in pixels (px)",
        ja: "ピクセル(px)単位の幅",
      },
      originalSizeTitle: { ko: "원본 크기", en: "Original size", ja: "元のサイズ" },
      originalSize: { ko: "원본", en: "Original", ja: "元のサイズ" },
    },
  },
  domains: {
    auth: {
      checkEmailAndPassword: {
        ko: "이메일 형식과 비밀번호(8자 이상)를 확인해주세요.",
        en: "Please check the email format and password (at least 8 characters).",
        ja: "メールアドレスの形式とパスワード（8文字以上）をご確認ください。",
      },
    },
  },
  pages: {
    login: {
      title: { ko: "로그인", en: "Log in", ja: "ログイン" },
      subtitle: {
        ko: "운영 콘솔 계정으로 로그인하세요.",
        en: "Log in with your operations console account.",
        ja: "運営コンソールのアカウントでログインしてください。",
      },
      emailLabel: { ko: "이메일", en: "Email", ja: "メールアドレス" },
      passwordLabel: { ko: "비밀번호", en: "Password", ja: "パスワード" },
      submit: { ko: "로그인", en: "Log in", ja: "ログイン" },
      submitting: { ko: "로그인 중...", en: "Logging in...", ja: "ログイン中..." },
      noAccount: {
        ko: "계정이 없으신가요?",
        en: "Don't have an account?",
        ja: "アカウントをお持ちでない方は",
      },
      registerLink: { ko: "회원가입", en: "Sign up", ja: "新規登録" },
      invalidCredentials: {
        ko: "이메일 또는 비밀번호가 올바르지 않습니다.",
        en: "The email or password is incorrect.",
        ja: "メールアドレスまたはパスワードが正しくありません。",
      },
      accountPending: {
        ko: "아직 승인 대기 중인 계정입니다. 승인이 완료되면 로그인할 수 있습니다.",
        en: "Your account is still pending approval. You can log in once it is approved.",
        ja: "まだ承認待ちのアカウントです。承認が完了するとログインできます。",
      },
      accountSuspended: {
        ko: "정지된 계정입니다. 관리자에게 문의하세요.",
        en: "This account has been suspended. Please contact an administrator.",
        ja: "停止されたアカウントです。管理者にお問い合わせください。",
      },
      loginNotAllowed: {
        ko: "로그인할 수 없습니다.",
        en: "Unable to log in.",
        ja: "ログインできません。",
      },
      loginFailed: {
        ko: "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        en: "A problem occurred while logging in. Please try again later.",
        ja: "ログイン中に問題が発生しました。しばらくしてからもう一度お試しください。",
      },
    },
    register: {
      title: { ko: "계정 생성", en: "Create account", ja: "アカウント作成" },
      subtitle: {
        ko: "가입 요청 후 관리자의 승인이 완료되어야 로그인할 수 있습니다.",
        en: "After requesting to sign up, you can log in once an administrator approves your request.",
        ja: "登録リクエスト後、管理者の承認が完了するとログインできます。",
      },
      emailLabel: { ko: "이메일", en: "Email", ja: "メールアドレス" },
      nameLabel: { ko: "이름 (선택)", en: "Name (optional)", ja: "名前（任意）" },
      passwordLabel: {
        ko: "비밀번호 (8자 이상)",
        en: "Password (at least 8 characters)",
        ja: "パスワード（8文字以上）",
      },
      submit: { ko: "가입 요청", en: "Request sign-up", ja: "登録リクエスト" },
      submitting: { ko: "요청 중...", en: "Requesting...", ja: "リクエスト中..." },
      hasAccount: {
        ko: "이미 계정이 있으신가요?",
        en: "Already have an account?",
        ja: "すでにアカウントをお持ちの方は",
      },
      loginLink: { ko: "로그인", en: "Log in", ja: "ログイン" },
      emailInUse: {
        ko: "이미 사용 중인 이메일입니다.",
        en: "This email is already in use.",
        ja: "すでに使用されているメールアドレスです。",
      },
      registerFailed: {
        ko: "계정 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        en: "A problem occurred while creating the account. Please try again later.",
        ja: "アカウント作成中に問題が発生しました。しばらくしてからもう一度お試しください。",
      },
      successTitle: {
        ko: "가입이 요청되었습니다",
        en: "Sign-up requested",
        ja: "登録がリクエストされました",
      },
      successReceived: {
        ko: "{email}로 가입 요청이 접수되었습니다.",
        en: "A sign-up request has been received for {email}.",
        ja: "{email}宛の登録リクエストを受け付けました。",
      },
      successApprovalNote: {
        ko: "관리자의 승인이 완료되면 로그인할 수 있습니다.",
        en: "You can log in once an administrator approves your request.",
        ja: "管理者の承認が完了するとログインできます。",
      },
      goToLogin: {
        ko: "로그인 페이지로 이동",
        en: "Go to login page",
        ja: "ログインページへ移動",
      },
    },
    notFound: {
      title: {
        ko: "페이지를 찾을 수 없어요",
        en: "Page not found",
        ja: "ページが見つかりません",
      },
      subtitle: {
        ko: "요청하신 주소가 변경되었거나 더 이상 존재하지 않습니다.",
        en: "The address you requested has been changed or no longer exists.",
        ja: "ご指定のアドレスは変更されたか、存在しません。",
      },
      goHome: { ko: "홈으로", en: "Go home", ja: "ホームへ" },
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
