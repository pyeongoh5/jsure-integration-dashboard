export const adminMessages = {
  common: {
    languageName: { ko: "한국어", en: "English", ja: "日本語" },
    cancel: { ko: "취소", en: "Cancel", ja: "キャンセル" },
    close: { ko: "닫기", en: "Close", ja: "閉じる" },
    apply: { ko: "적용", en: "Apply", ja: "適用" },
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
    application: {
      status: {
        applied: { ko: "승인 대기", en: "Pending approval", ja: "承認待ち" },
        preShip: { ko: "승인·배송전", en: "Approved · Pre-ship", ja: "承認済み・発送前" },
        shipping: { ko: "배송중", en: "Shipping", ja: "配送中" },
        delivered: { ko: "수령 확인 대기", en: "Awaiting receipt", ja: "受取確認待ち" },
        postDue: { ko: "투고 대기", en: "Awaiting post", ja: "投稿待ち" },
        awaitingOrder: { ko: "주문 대기", en: "Awaiting order", ja: "注文待ち" },
        awaitingReview: { ko: "리뷰 대기", en: "Awaiting review", ja: "レビュー待ち" },
        rejected: { ko: "반려", en: "Rejected", ja: "却下" },
      },
      category: {
        sns: { ko: "SNS", en: "SNS", ja: "SNS" },
        fakePurchase: { ko: "가구매", en: "Fake purchase", ja: "仮購入" },
        simpleReview: { ko: "단순 리뷰", en: "Simple review", ja: "簡易レビュー" },
      },
      applicants: {
        time: {
          justNow: { ko: "방금", en: "Just now", ja: "たった今" },
        },
        errors: {
          loadFailed: {
            ko: "응모자 목록을 불러올 수 없습니다.",
            en: "Failed to load the applicant list.",
            ja: "応募者一覧を読み込めませんでした。",
          },
          mutationFailed: {
            ko: "처리에 실패했습니다.",
            en: "The operation failed.",
            ja: "処理に失敗しました。",
          },
          trackingRequired: {
            ko: "택배사와 운송장 번호를 입력하세요.",
            en: "Enter the carrier and tracking number.",
            ja: "配送業者と送り状番号を入力してください。",
          },
        },
        table: {
          influencer: { ko: "인플루언서", en: "Influencer", ja: "インフルエンサー" },
          campaign: { ko: "캠페인", en: "Campaign", ja: "キャンペーン" },
          category: { ko: "카테고리", en: "Category", ja: "カテゴリー" },
          subType: { ko: "서브타입", en: "Sub-type", ja: "サブタイプ" },
          followers: { ko: "팔로워", en: "Followers", ja: "フォロワー" },
          appliedAt: { ko: "응모 시각", en: "Applied at", ja: "応募日時" },
          status: { ko: "상태", en: "Status", ja: "ステータス" },
          actions: { ko: "액션", en: "Actions", ja: "アクション" },
          empty: {
            ko: "해당 상태의 응모자가 없습니다.",
            en: "No applicants in this status.",
            ja: "この状態の応募者はいません。",
          },
          flagged: { ko: "대상외", en: "Excluded", ja: "対象外" },
          representativeSns: {
            ko: "대표 SNS: {snsType} - @{handle}",
            en: "Main SNS: {snsType} - @{handle}",
            ja: "代表SNS: {snsType} - @{handle}",
          },
        },
        actions: {
          memo: { ko: "메모", en: "Memo", ja: "メモ" },
          detail: { ko: "상세", en: "Details", ja: "詳細" },
          history: { ko: "이력", en: "History", ja: "履歴" },
          approve: { ko: "승인", en: "Approve", ja: "承認" },
          reject: { ko: "반려", en: "Reject", ja: "却下" },
          enterTracking: { ko: "운송장 입력", en: "Enter tracking", ja: "送り状入力" },
          undo: { ko: "되돌리기", en: "Undo", ja: "元に戻す" },
          deliver: { ko: "배송 완료", en: "Mark delivered", ja: "配送完了" },
        },
        approveDialog: {
          title: {
            ko: "응모를 승인할까요?",
            en: "Approve this application?",
            ja: "この応募を承認しますか？",
          },
        },
        rejectDialog: {
          title: {
            ko: "응모를 반려할까요?",
            en: "Reject this application?",
            ja: "この応募を却下しますか？",
          },
          reasonPlaceholder: {
            ko: "반려 사유를 입력하세요 (선택)",
            en: "Enter a rejection reason (optional)",
            ja: "却下理由を入力してください（任意）",
          },
        },
        undoDialog: {
          title: {
            ko: "심사를 되돌릴까요?",
            en: "Undo the review?",
            ja: "審査を元に戻しますか？",
          },
          hint: {
            ko: "대기 상태로 되돌립니다.",
            en: "It will be returned to the pending state.",
            ja: "承認待ちの状態に戻します。",
          },
        },
        shipDialog: {
          title: {
            ko: "운송장 정보를 입력하세요",
            en: "Enter tracking information",
            ja: "送り状情報を入力してください",
          },
          carrier: { ko: "택배사", en: "Carrier", ja: "配送業者" },
          carrierName: { ko: "택배사명", en: "Carrier name", ja: "配送業者名" },
          customCarrierOption: { ko: "직접 입력", en: "Enter manually", ja: "直接入力" },
          customCarrierPlaceholder: {
            ko: "택배사 이름 직접 입력",
            en: "Enter the carrier name manually",
            ja: "配送業者名を直接入力",
          },
          trackingNumber: { ko: "운송장 번호", en: "Tracking number", ja: "送り状番号" },
          confirm: { ko: "배송 시작", en: "Start shipping", ja: "配送開始" },
        },
        deliverDialog: {
          title: {
            ko: "배송 완료로 표시할까요?",
            en: "Mark as delivered?",
            ja: "配送完了にしますか？",
          },
          trackingInfo: {
            ko: "운송장 번호: {tracking}",
            en: "Tracking number: {tracking}",
            ja: "送り状番号: {tracking}",
          },
        },
        campaignFilter: {
          chipEmpty: { ko: "+ 캠페인", en: "+ Campaign", ja: "+ キャンペーン" },
          activeLabel: { ko: "캠페인: {title}", en: "Campaign: {title}", ja: "キャンペーン: {title}" },
          loading: { ko: "불러오는 중…", en: "Loading…", ja: "読み込み中…" },
          title: { ko: "캠페인 선택", en: "Select campaign", ja: "キャンペーン選択" },
          titleOngoing: {
            ko: "캠페인 선택 (진행중)",
            en: "Select campaign (ongoing)",
            ja: "キャンペーン選択（進行中）",
          },
          searchPlaceholder: { ko: "캠페인 검색", en: "Search campaigns", ja: "キャンペーン検索" },
          noSearchResults: {
            ko: "검색 결과가 없습니다.",
            en: "No search results.",
            ja: "検索結果はありません。",
          },
          scopeOngoing: { ko: "진행중", en: "Ongoing", ja: "進行中" },
          scopeAll: { ko: "전체", en: "All", ja: "すべて" },
          scopeClosed: { ko: "종료", en: "Closed", ja: "終了" },
          emptyOngoing: {
            ko: "진행중인 캠페인이 없습니다.",
            en: "No ongoing campaigns.",
            ja: "進行中のキャンペーンはありません。",
          },
          emptyAll: {
            ko: "캠페인이 없습니다.",
            en: "No campaigns.",
            ja: "キャンペーンはありません。",
          },
          emptyClosed: {
            ko: "종료된 캠페인이 없습니다.",
            en: "No closed campaigns.",
            ja: "終了したキャンペーンはありません。",
          },
        },
        statusFilter: {
          chipEmpty: { ko: "+ 상태", en: "+ Status", ja: "+ ステータス" },
          prefix: { ko: "상태", en: "Status", ja: "ステータス" },
          title: {
            ko: "상태 선택 (복수 가능)",
            en: "Select statuses (multiple)",
            ja: "ステータス選択（複数可）",
          },
        },
        categoryFilter: {
          chipEmpty: { ko: "+ 카테고리", en: "+ Category", ja: "+ カテゴリー" },
          prefix: { ko: "카테고리", en: "Category", ja: "カテゴリー" },
          title: { ko: "카테고리 선택", en: "Select category", ja: "カテゴリー選択" },
        },
        subTypeFilter: {
          chipEmpty: { ko: "+ 서브타입", en: "+ Sub-type", ja: "+ サブタイプ" },
          prefix: { ko: "서브타입", en: "Sub-type", ja: "サブタイプ" },
          title: {
            ko: "서브타입 선택 (복수 가능)",
            en: "Select sub-types (multiple)",
            ja: "サブタイプ選択（複数可）",
          },
        },
        minFollowersFilter: {
          chipEmpty: { ko: "+ 팔로워 범위", en: "+ Follower range", ja: "+ フォロワー範囲" },
          title: { ko: "팔로워 최소값", en: "Minimum followers", ja: "フォロワー最小値" },
          activeLabel: {
            ko: "팔로워 {count}명 이상",
            en: "{count}+ followers",
            ja: "フォロワー{count}人以上",
          },
          suffix: { ko: "명 이상", en: "or more", ja: "人以上" },
          placeholder: { ko: "예: 10000", en: "e.g. 10000", ja: "例: 10000" },
        },
      },
    },
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
