export const messages = {
  components: {
    bottomTab: {
      search: { jp: "探す", kr: "찾기1" },
      applications: { jp: "応募履歴", kr: "지원 내역" },
      notices: { jp: "お知らせ", kr: "알림" },
      myPage: { jp: "マイページ", kr: "마이페이지" },
    },
    wizardFooter: {
      next: { jp: "次へ", kr: "다음" },
      back: { jp: "戻る", kr: "뒤로" },
      submitting: { jp: "送信中…", kr: "전송 중…" },
    },
    formField: {
      defaultError: { jp: "入力内容を確認してください", kr: "입력 내용을 확인해 주세요" },
    },
    pageHeader: {
      backAriaLabel: { jp: "戻る", kr: "뒤로" },
    },
  },
  auth: {
    terms: {
      agreeAll: { jp: "すべての項目に同意します", kr: "모든 항목에 동의합니다" },
      uncheckAriaLabel: { jp: "解除", kr: "해제" },
      checkAriaLabel: { jp: "同意", kr: "동의" },
      requiredTag: { jp: "[必須]", kr: "[필수]" },
    },
    snsAccount: {
      followerCount: { jp: "フォロワー数", kr: "팔로워 수" },
    },
  },
  campaign: {
    card: {
      ended: { jp: "終了", kr: "종료" },
      upcoming: { jp: "開始前", kr: "시작 전" },
      upcomingStart: { jp: "開始予定", kr: "시작 예정" },
      followerLabel: { jp: "フォロワー", kr: "팔로워" },
      subscriberLabel: { jp: "登録者", kr: "구독자" },
      instagramFeed: { jp: "フィード", kr: "피드" },
      instagramReels: { jp: "リール", kr: "릴스" },
      followerMinSuffix: { jp: "人以上", kr: "명 이상" },
      noLimit: { jp: "制限なし", kr: "제한 없음" },
      yenSuffix: { jp: "円", kr: "엔" },
      recruitPrefix: { jp: "募集", kr: "모집" },
      peopleSuffix: { jp: "名", kr: "명" },
    },
    category: {
      sns: { jp: "SNS", kr: "SNS" },
      fakePurchase: { jp: "仮購入", kr: "가구매" },
      simpleReview: { jp: "単純レビュー", kr: "단순 리뷰" }, // new
    },
    subType: {
      qoo10: { jp: "Qoo10", kr: "Qoo10" },
      lips: { jp: "LIPS", kr: "LIPS" },
      atcosme: { jp: "@cosme", kr: "@cosme" },
    },
    detail: {
      productUrl: { jp: "商品ページ", kr: "상품 페이지" },
      expectedSettlement: { jp: "精算予定金額", kr: "예상 정산액" },
      productPrice: { jp: "商品価格", kr: "상품 가격" },
      reviewChannels: { jp: "レビューチャンネル", kr: "리뷰 채널" },
    },
  },
  me: {
    address: {
      heading: { jp: "住所", kr: "주소" },
      postalCodeLabel: { jp: "郵便番号", kr: "우편번호" },
      postalCodeError: { jp: "郵便番号は7桁", kr: "우편번호는 7자리" },
      lookupLoading: { jp: "住所を検索中…", kr: "주소 검색 중…" },
      lookupNotFound: {
        jp: "該当する住所が見つかりませんでした",
        kr: "해당하는 주소를 찾지 못했습니다",
      },
      lookupError: {
        jp: "住所検索に失敗しました。手動で入力してください",
        kr: "주소 검색에 실패했습니다. 직접 입력해 주세요",
      },
      postalHint: {
        jp: "例: 150-0001 （郵便番号から住所が自動入力されます）",
        kr: "예: 150-0001 (입력하면 자동으로 채워집니다)",
      },
      prefectureLabel: { jp: "都道府県", kr: "도도부현" },
      prefectureError: { jp: "都道府県を選択してください", kr: "도도부현을 선택해 주세요" },
      prefecturePlaceholder: { jp: "選択してください", kr: "선택해 주세요" },
      cityLabel: { jp: "市区町村", kr: "시구정촌" },
      cityError: { jp: "市区町村は必須", kr: "시구정촌은 필수" },
      cityPlaceholder: { jp: "渋谷区神宮前", kr: "시부야구 진구마에" },
      addressLine1Label: { jp: "番地", kr: "지번" },
      addressLine1Error: { jp: "番地は必須", kr: "지번은 필수" },
      addressLine1Placeholder: { jp: "1-2-3", kr: "1-2-3" },
      addressLine2Label: { jp: "建物名・部屋番号 (任意)", kr: "건물명·호수 (선택)" },
      addressLine2Placeholder: { jp: "ABCビル 502号室", kr: "ABC빌딩 502호" },
    },
    bank: {
      searchTrigger: { jp: "銀行を検索", kr: "은행 검색" },
      closeAriaLabel: { jp: "閉じる", kr: "닫기" },
      searchPlaceholder: { jp: "銀行名 / 4桁コード", kr: "은행명 / 4자리 코드" },
      empty: { jp: "該当する銀行がありません", kr: "해당하는 은행이 없습니다" },
    },
  },
  application: {
    stageLabel: {
      APPLIED: { jp: "応募済", kr: "응모 완료" },
      APPROVED: { jp: "承認", kr: "승인" },
      SHIPPED: { jp: "発送中", kr: "배송 중" },
      AWAITING_RECEIPT: { jp: "受領確認待ち", kr: "수령 확인 대기" },
      POSTING: { jp: "投稿期間", kr: "게시 기간" },
      POSTED: { jp: "投稿完了", kr: "게시 완료" },
      POST_REJECTED: { jp: "投稿差し戻し", kr: "게시 반려" },
      INSIGHT_DUE: { jp: "インサイト提出", kr: "인사이트 제출" },
      REVIEWING: { jp: "確認中", kr: "검수 중" },
      COMPLETED: { jp: "精算待ち", kr: "정산 대기" }, // new
      SETTLED: { jp: "キャンペーン終了", kr: "캠페인 종료" }, // new
      REJECTED: { jp: "未選定", kr: "미선정" },
      CANCELLED: { jp: "キャンセル", kr: "취소" },
    },
    dateFormat: {
      monthSuffix: { jp: "月", kr: "월" },
      daySuffix: { jp: "日", kr: "일" },
    },
    card: {
      actionAwaitingReceipt: { jp: "受領を確認", kr: "수령 확인" },
      actionPosting: { jp: "投稿URLを提出", kr: "게시 URL 제출" },
      actionInsightDue: { jp: "インサイトを提出", kr: "인사이트 제출" },
      transferSuffix: { jp: "振込", kr: "입금" },
    },
    stepper: {
      step1: { jp: "応募", kr: "응모" },
      step2: { jp: "承認", kr: "승인" },
      step3: { jp: "発送", kr: "발송" },
      step4: { jp: "受取", kr: "수령" },
      step5: { jp: "投稿", kr: "게시" },
      step6: { jp: "確認", kr: "검수" },
      step7: { jp: "精算待ち", kr: "정산 대기" }, // new
      step8: { jp: "キャンペーン終了", kr: "캠페인 종료" }, // new
      terminalRejected: { jp: "未選定", kr: "미선정" },
      terminalCancelled: { jp: "キャンセル", kr: "취소" },
      simpleReview: { // new
        step1: { jp: "応募", kr: "응모" },
        step2: { jp: "承認", kr: "승인" },
        step3: { jp: "発送", kr: "발송" }, // new
        step4: { jp: "受領確認", kr: "수령확인" }, // new
        step5: { jp: "レビュー提出", kr: "리뷰 제출" }, // new
        step6: { jp: "確認", kr: "검수" }, // new
        step7: { jp: "精算待ち", kr: "정산 대기" }, // new
        step8: { jp: "キャンペーン終了", kr: "캠페인 종료" }, // new
      },
    },
    filters: {
      statusApplied: { jp: "応募", kr: "응모" },
      statusRejected: { jp: "未選定", kr: "미선정" },
      statusInProgress: { jp: "進行中", kr: "진행 중" },
      statusEnded: { jp: "終了", kr: "종료" },
      statusCancelled: { jp: "キャンセル", kr: "취소" },
      categoryChipPrefix: { jp: "カテゴリ", kr: "카테고리" }, // new
      categoryChipEmpty: { jp: "+ カテゴリ", kr: "+ 카테고리" }, // new
      statusChipPrefix: { jp: "状態", kr: "상태" },
      statusChipEmpty: { jp: "+ 状態", kr: "+ 상태" },
      popoverStatusTitle: { jp: "状態を選択", kr: "상태 선택" },
      popoverCategoryTitle: { jp: "カテゴリを選択（複数可）", kr: "카테고리 선택 (복수 가능)" }, // new
      popoverClose: { jp: "閉じる", kr: "닫기" },
    },
    cancelConfirm: {
      title: { jp: "【ご注意】 応募の取り消し確認", kr: "[주의] 응모 취소 확인" },
      body: {
        jp: "一度取り消しを行うと、元の状態に戻すことはできません。また、本キャンペーンへの再応募も不可となります。本当に取り消しますか？",
        kr: "한 번 취소하면 원래 상태로 되돌릴 수 없습니다. 또한 이 캠페인에 재응모하실 수도 없습니다. 정말 취소하시겠습니까?",
      },
      submitting: { jp: "処理中…", kr: "처리 중…" },
      confirm: { jp: "はい", kr: "예" },
      cancel: { jp: "いいえ", kr: "아니오" },
    },
    receiptConfirm: {
      title: { jp: "受領を確認しますか？", kr: "수령을 확인하시겠습니까?" },
      bodyPrefix: {
        jp: "受領を確認すると、今から投稿期間（",
        kr: "수령을 확인하시면 지금부터 게시 기간(",
      },
      bodySuffix: {
        jp: "日）が始まります。",
        kr: "일)이 시작됩니다.",
      },
      warn: { jp: "この操作は取り消せません。", kr: "이 작업은 취소할 수 없습니다." },
      cancel: { jp: "キャンセル", kr: "취소" },
      submitting: { jp: "送信中…", kr: "전송 중…" },
      confirm: { jp: "受領を確認する", kr: "수령 확인" },
    },
    attachmentUpload: {
      unsupportedPrefix: { jp: "対応していない形式: ", kr: "지원하지 않는 형식: " },
      oversizedPrefix: { jp: "5MB を超えるファイル: ", kr: "5MB를 초과하는 파일: " },
      maxFilesPrefix: { jp: "最大", kr: "최대 " },
      maxFilesSuffix: { jp: "枚まで添付できます", kr: "장까지 첨부할 수 있습니다" },
      genericError: {
        jp: "アップロード中にエラーが発生しました",
        kr: "업로드 중 오류가 발생했습니다",
      },
      dropzoneMain: {
        jp: "クリックまたはドラッグして画像を追加",
        kr: "클릭 또는 드래그하여 이미지 추가",
      },
      uploading: { jp: "アップロード中…", kr: "업로드 중…" },
      limitReached: {
        jp: "添付枚数が上限に達しました",
        kr: "첨부 매수가 상한에 도달했습니다",
      },
      unitSuffix: { jp: "枚", kr: "장" },
      removeAriaLabel: { jp: "削除", kr: "삭제" },
      hintPrefix: { jp: "PNG / JPEG / WebP · 最大", kr: "PNG / JPEG / WebP · 최대 " },
      hintSuffix: { jp: "枚 · 5MB以下", kr: "장 · 5MB 이하" },
    },
    orderForm: {
      orderNumberPlaceholder: {
        jp: "注文番号を入力",
        kr: "주문번호를 입력해 주세요",
      },
      orderNumberRequired: {
        jp: "注文番号を入力してください",
        kr: "주문번호를 입력해 주세요",
      },
      receiptsRequired: {
        jp: "注文明細のスクリーンショットを1枚以上ご提出ください",
        kr: "주문 명세서 스크린샷을 1장 이상 제출해 주세요",
      },
      submitting: { jp: "送信中…", kr: "전송 중…" },
    },
    reviewForm: {
      urlPlaceholder: { jp: "https://…", kr: "https://…" },
      urlInvalid: {
        jp: "有効なURLを入力してください",
        kr: "올바른 URL을 입력해 주세요",
      },
      screenshotsRequiredPrefix: { // new — 필수 매수가 채널 수에 따라 2~4장 가변
        jp: "レビューのスクリーンショットを",
        kr: "리뷰 스크린샷을 ",
      },
      screenshotsRequiredSuffix: { // new
        jp: "枚以上ご提出ください",
        kr: "장 이상 제출해 주세요",
      },
      submitting: { jp: "送信中…", kr: "전송 중…" },
      deadlinePassed: { jp: "投稿期限を過ぎています", kr: "게시 기한이 지났습니다" },
      channelUrlLabelSuffix: { jp: "レビューURL", kr: "리뷰 URL" },
      channelUrlPlaceholder: { jp: "https://…", kr: "https://…" },
      channelUrlRequired: {
        jp: "各チャンネルのレビューURLをご入力ください",
        kr: "각 채널의 리뷰 URL을 입력해 주세요",
      },
    },
    insightForm: {
      metricInvalid: { jp: "数字を入力", kr: "숫자를 입력해 주세요" },
      metricLikes: { jp: "いいね数", kr: "좋아요 수" },
      metricComments: { jp: "コメント数", kr: "댓글 수" },
      metricShares: { jp: "シェア数", kr: "공유 수" },
      metricReposts: { jp: "リポスト数", kr: "리포스트 수" },
      metricSaves: { jp: "保存数", kr: "저장 수" },
      metricViews: { jp: "閲覧数", kr: "조회 수" },
      metricReach: { jp: "リーチ数", kr: "도달 수" },
      unsupportedFilePrefix: { jp: "対応していない形式: ", kr: "지원하지 않는 형식: " },
      oversizedFilePrefix: { jp: "5MB を超えるファイル: ", kr: "5MB를 초과하는 파일: " },
      uploadFailedPrefix: { jp: "アップロード失敗: ", kr: "업로드 실패: " },
      maxFilesPrefix: { jp: "最大", kr: "최대 " },
      maxFilesSuffix: { jp: "枚まで添付できます", kr: "장까지 첨부할 수 있습니다" },
      uploadGenericError: {
        jp: "アップロード中にエラーが発生しました",
        kr: "업로드 중 오류가 발생했습니다",
      },
      guidance: {
        jp: "投稿のインサイトをご提出ください。",
        kr: "게시물의 인사이트를 제출해 주세요.",
      },
      dueLabelPrefix: { jp: "インサイト提出日: ", kr: "인사이트 제출일: " },
      reachHint: {
        jp: "リーチ数が表示されない場合は、「0」とご入力いただくようお願いいたします。",
        kr: "도달 수가 표시되지 않는 경우 「0」으로 입력해 주세요.",
      },
      screenshotTitle: { jp: "インサイトのスクリーンショット", kr: "인사이트 스크린샷" },
      screenshotHintPrefix: { jp: "PNG / JPEG / WebP · 最大", kr: "PNG / JPEG / WebP · 최대 " },
      screenshotHintSuffix: { jp: "枚 · 5MB以下", kr: "장 · 5MB 이하" },
      uploading: { jp: "アップロード中…", kr: "업로드 중…" },
      limitReached: { jp: "添付枚数が上限に達しました", kr: "첨부 매수가 상한에 도달했습니다" },
      dropzoneMain: {
        jp: "クリックまたはドラッグして画像を追加",
        kr: "클릭 또는 드래그하여 이미지 추가",
      },
      unitSuffix: { jp: "枚", kr: "장" },
      removeAriaLabel: { jp: "削除", kr: "삭제" },
      submitting: { jp: "送信中…", kr: "전송 중…" },
      submit: { jp: "インサイトを提出", kr: "인사이트 제출" },
      nextStep: { jp: "次へ", kr: "다음" }, // new — 서브타입 퍼널 이동
      prevStep: { jp: "戻る", kr: "이전" }, // new
    },
    postForm: {
      urlInvalid: { jp: "有効なURLを入力してください", kr: "올바른 URL을 입력해 주세요" },
      labelSuffix: { jp: "投稿URL", kr: "게시 URL" },
      submitting: { jp: "送信中…", kr: "전송 중…" },
      update: { jp: "投稿URLを更新", kr: "게시 URL 업데이트" },
      submit: { jp: "投稿URLを提出", kr: "게시 URL 제출" },
      prHint: {
        jp: "⚠ 投稿冒頭に #PR を必ず記載",
        kr: "⚠ 게시물 처음에 #PR을 반드시 기재해 주세요",
      },
      deadlineLabelPrefix: { jp: "投稿締切日: ", kr: "게시 마감일: " },
    },
    simpleReviewForm: { // new
      urlInvalid: { jp: "有効なURLを入力してください", kr: "올바른 URL을 입력해 주세요" },
      labelSuffix: { jp: "レビューURL", kr: "리뷰 URL" },
      screenshotsLabelSuffix: { // new
        jp: "レビューのスクリーンショット提出",
        kr: "리뷰 스크린샷 제출",
      },
      screenshotsRequired: { // new
        jp: "レビューのスクリーンショットを1枚以上ご提出ください",
        kr: "리뷰 스크린샷을 1장 이상 제출해 주세요",
      },
      submitting: { jp: "送信中…", kr: "전송 중…" },
      update: { jp: "レビューURLを更新", kr: "리뷰 URL 업데이트" },
      submit: { jp: "レビューURLを提出", kr: "리뷰 URL 제출" },
      deadlineLabelPrefix: { jp: "レビュー締切日: ", kr: "리뷰 마감일: " },
    },
    stage: {
      awaitingOrder: {
        heading: { jp: "ご注文をお願いいたします", kr: "주문을 진행해 주세요" },
        description: {
          jp: "商品をご購入後、注文番号と注文明細のスクリーンショットをご提出ください",
          kr: "상품 구매 후 주문번호와 주문 명세서 스크린샷을 제출해 주세요",
        },
        orderNumberLabel: { jp: "注文番号", kr: "주문번호" },
        receiptsLabel: {
          jp: "注文明細のスクリーンショット (1枚以上)",
          kr: "주문 명세서 스크린샷 (1장 이상)",
        },
        submit: { jp: "提出する", kr: "제출" },
      },
      awaitingReview: {
        heading: { jp: "レビューの投稿をお願いいたします", kr: "리뷰를 제출해 주세요" },
        description: {
          jp: "各プラットフォームでレビューを投稿後、URLとスクリーンショットをご提出ください",
          kr: "각 플랫폼에 리뷰를 게시한 뒤 URL과 스크린샷을 제출해 주세요",
        },
        urlLabel: { jp: "レビューURL", kr: "리뷰 URL" },
        screenshotsLabelPrefix: { // new — 필수 매수 가변 표기 (Qoo10 2장 + 채널당 1장)
          jp: "レビューのスクリーンショット (",
          kr: "리뷰 스크린샷 제출 (",
        },
        screenshotsLabelSuffix: { // new
          jp: "枚以上)",
          kr: "장 이상)",
        },
        deadlineDaysPrefix: { jp: "投稿期限まであと", kr: "리뷰 마감까지 " },
        deadlineDaysSuffix: { jp: "日", kr: "일" },
        submit: { jp: "提出する", kr: "제출" },
      },
      reviewPending: {
        description: {
          jp: "提出いただいたレビューを確認中です",
          kr: "제출한 리뷰를 검토 중입니다",
        },
      },
      reviewRejected: {
        heading: {
          jp: "レビューの再提出をお願いいたします",
          kr: "리뷰 재제출이 필요합니다",
        },
        reasonLabel: { jp: "修正の理由", kr: "반려 사유" },
        description: {
          jp: "ガイドラインに沿ってレビューを修正し、URLとスクリーンショットを再度ご提出ください",
          kr: "가이드라인에 맞게 리뷰를 수정한 뒤 URL과 스크린샷을 다시 제출해 주세요",
        },
      },
    },
  },
  pages: {
    apply: {
      confirmPr: {
        jp: "投稿冒頭に「#PR」または「ブランドから提供」表記",
        kr: "게시물 처음에 「#PR」 또는 「브랜드에서 제공」 표기",
      },
      confirmDeadlinePrefix: { jp: "受取後", kr: "수령 후 " }, // new
      confirmDeadlineSuffix: { jp: "日以内に投稿", kr: "일 이내에 게시" }, // new
      confirmInsights: { jp: "投稿7日後にインサイト提出", kr: "게시 후 7일 뒤 인사이트 제출" },
      confirmYakkiho: { jp: "薬機法の遵守", kr: "약기법 준수" },
      confirmGuideline: { jp: "ガイドラインの確認・遵守", kr: "가이드라인 확인·준수" },
      snsFollower: { jp: "フォロワー", kr: "팔로워" },
      snsSubscriber: { jp: "登録者", kr: "구독자" },
      instagramFeed: { jp: "フィード", kr: "피드" },
      instagramReels: { jp: "リール", kr: "릴스" },
      errorFallback: { jp: "応募に失敗しました", kr: "응모에 실패했습니다" },
      loading: { jp: "読み込み中…", kr: "불러오는 중…" },
      notFound: { jp: "キャンペーンが見つかりません", kr: "캠페인을 찾을 수 없습니다" },
      title: { jp: "応募確認", kr: "응모 확인" },
      snsSectionTitle: { jp: "応募に使用するSNSを選択", kr: "응모에 사용할 SNS 선택" },
      fakePurchaseSectionTitle: { jp: "応募内容", kr: "응모 내용" },
      noQualifying: {
        jp: "応募条件を満たすSNSアカウントがありません",
        kr: "응모 조건을 충족하는 SNS 계정이 없습니다",
      },
      requiredBadge: { jp: "必須", kr: "필수" }, // new
      requiredNotQualifiedPrefix: { // new
        jp: "このキャンペーンは ",
        kr: "이 캠페인은 ",
      },
      requiredNotQualifiedSuffix: { // new
        jp: " の応募が必須ですが、応募条件を満たすアカウントがありません",
        kr: " 응모가 필수이지만 자격 조건을 만족하는 계정이 없습니다",
      },
      alreadyAppliedNotice: { // new — 캠페인 단위 응모 이력이 있으면 재응모 불가
        jp: "この案件はすでに応募済みのため、再応募できません",
        kr: "이미 응모한 캠페인입니다. 다시 응모할 수 없습니다",
      },
      excludedTag: {
        jp: "参加不可（類似キャンペーンに応募済み）",
        kr: "참여 불가 (유사 캠페인에 응모 완료)",
      },
      condPrefix: { jp: "応募条件: ", kr: "응모 조건: " },
      followerMinSuffix: { jp: "人以上", kr: "명 이상" },
      noLimit: { jp: "制限なし", kr: "제한 없음" },
      currentPrefix: { jp: "（現在: ", kr: " (현재: " },
      currentSuffix: { jp: "人）", kr: "명)" },
      notRegistered: { jp: "（アカウント未登録）", kr: " (계정 미등록)" },
      instagramPostTypeTitle: { jp: "Instagram 投稿タイプ", kr: "Instagram 게시 유형" },
      selectPostType: { jp: "投稿タイプを選択してください", kr: "게시 유형을 선택해 주세요" },
      addressTitle: { jp: "お届け先住所", kr: "배송지 주소" },
      confirmAddress: { jp: "この住所で受け取ります", kr: "이 주소로 수령합니다" },
      editAddress: { jp: "住所を修正する", kr: "주소 수정" },
      addressNotice: {
        jp: "上記の内容に変更がある場合は、マイページで更新のうえ、再度ご応募ください。",
        kr: "위 내용에 변경이 있는 경우 마이페이지에서 업데이트한 뒤 다시 응모해 주세요.",
      },
      addressCaution: {
        jp: "※住所の転送手続きを行う場合、転送費用をご負担いただくことがございますので、あらかじめご了承ください。",
        kr: "※주소 전송 절차를 진행하실 경우 전송 비용을 부담하실 수 있으니 미리 양해 부탁드립니다.",
      },
      addressMissing: {
        jp: "お届け先住所が未登録です。",
        kr: "배송지 주소가 등록되어 있지 않습니다.",
      },
      registerAddress: { jp: "住所を登録する", kr: "주소 등록" },
      confirmSectionTitle: { jp: "応募にあたっての再確認", kr: "응모 전 재확인" },
      ctaClosed: { jp: "募集終了", kr: "모집 종료" },
      ctaSubmitting: { jp: "送信中…", kr: "전송 중…" },
      ctaSubmit: { jp: "応募を送信", kr: "응모 제출" },
    },
    signup: {
      bank: {
        branchNameRequired: { jp: "支店名は必須", kr: "지점명은 필수" },
        branchCodeInvalid: { jp: "支店コードは3桁", kr: "지점 코드는 3자리" },
        accountNumberInvalid: { jp: "口座番号は7桁", kr: "계좌번호는 7자리" }, // new
        kanaInvalid: { jp: "カナで入力してください", kr: "가타카나로 입력해 주세요" },
        bankRequired: { jp: "銀行を選択してください", kr: "은행을 선택해 주세요" },
        reviewInputs: { jp: "入力内容を再度ご確認ください", kr: "입력 내용을 다시 확인해 주세요" },
        signupFailed: {
          jp: "会員登録に失敗しました。しばらくしてから再度お試しください。",
          kr: "가입에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
        heading: { jp: "振込先口座", kr: "입금 계좌" },
        bankLabel: { jp: "銀行", kr: "은행" },
        branchNameLabel: { jp: "支店名", kr: "지점명" },
        branchNamePlaceholder: { jp: "渋谷支店", kr: "시부야 지점" },
        branchCodeLabel: { jp: "支店コード (3桁)", kr: "지점 코드 (3자리)" },
        accountNumberLabel: { jp: "口座番号 (7桁)", kr: "계좌번호 (7자리)" }, // new
        accountHolderKanaLabel: { jp: "口座名義 (カナ)", kr: "예금주명 (가타카나)" },
        kanaHint: { jp: "例: ヤマダ ハナコ", kr: "예: ヤマダ ハナコ" },
        submit: { jp: "登録完了", kr: "가입 완료" },
      },
      profile: {
        nameRequired: { jp: "お名前は必須", kr: "이름은 필수" },
        kanaInvalid: { jp: "カナで入力してください", kr: "가타카나로 입력해 주세요" },
        phoneInvalid: { jp: "電話番号は10~15桁", kr: "전화번호는 10~15자리" },
        birthDateInvalid: { jp: "生年月日を入力してください", kr: "생년월일을 입력해 주세요" },
        heading: { jp: "プロフィール", kr: "프로필" },
        nameLabel: { jp: "お名前", kr: "이름" },
        nameKanaLabel: { jp: "お名前 (カナ)", kr: "이름 (가타카나)" },
        kanaHint: { jp: "例: ヤマダ ハナコ", kr: "예: ヤマダ ハナコ" },
        phoneLabel: { jp: "電話番号", kr: "전화번호" },
        phonePlaceholder: { jp: "09012345678", kr: "09012345678" },
        birthDateLabel: { jp: "生年月日", kr: "생년월일" },
      },
      sns: {
        atLeastOne: {
          jp: "1つ以上のSNSアカウントを追加してください",
          kr: "1개 이상의 SNS 계정을 추가해 주세요",
        },
        handleRequired: { jp: "ハンドルを入力してください", kr: "핸들을 입력해 주세요" },
        followerCountInvalid: { jp: "フォロワー数は数字のみ", kr: "팔로워 수는 숫자만" },
        heading: { jp: "SNSアカウント", kr: "SNS 계정" },
        hint: {
          jp: "登録するSNSを選択して情報を入力 (1つ以上必須)",
          kr: "등록할 SNS를 선택하고 정보를 입력해 주세요 (1개 이상 필수)",
        },
      },
      account: {
        emailInvalid: {
          jp: "正しいメールアドレスを入力してください",
          kr: "올바른 이메일 주소를 입력해 주세요",
        },
        heading: { jp: "メールアドレス", kr: "이메일 주소" },
        hint: {
          jp: "LINEでのご連絡が届かない場合に備えて、メールアドレスをご登録ください。",
          kr: "LINE으로 연락이 닿지 않을 경우를 대비해 이메일 주소를 등록해 주세요.",
        },
        emailLabel: { jp: "メールアドレス", kr: "이메일 주소" },
      },
      terms: {
        agreeAllRequired: {
          jp: "全ての利用規約に同意してください",
          kr: "모든 이용약관에 동의해 주세요",
        },
        heading: { jp: "利用規約への同意", kr: "이용약관 동의" },
      },
      lineSignup: {
        linking: { jp: "LINEアカウントを連携中…", kr: "LINE 계정을 연동 중…" },
      },
    },
    applications: {
      list: {
        title: { jp: "応募履歴", kr: "응모 내역" },
        loading: { jp: "読み込み中…", kr: "불러오는 중…" },
        loadError: { jp: "読み込みに失敗しました", kr: "불러오지 못했습니다" },
        empty: { jp: "まだ応募していません", kr: "아직 응모하지 않았습니다" },
        findCampaign: { jp: "キャンペーンを探す", kr: "캠페인 찾기" },
        filteredEmpty: { jp: "該当する応募がありません", kr: "해당하는 응모가 없습니다" },
      },
      detail: {
        loading: { jp: "読み込み中…", kr: "불러오는 중…" },
        loadError: { jp: "読み込みに失敗しました", kr: "불러오지 못했습니다" },
        msgApplied: { jp: "承認をお待ちください。", kr: "승인을 기다려 주세요." },
        msgApproved: { jp: "JSUREで発送準備中です。", kr: "JSURE에서 발송 준비 중입니다." },
        trackingCarrier: { jp: "配送業者", kr: "배송업체" },
        trackingNumber: { jp: "運送番号", kr: "운송장 번호" },
        msgShipped: { jp: "配送状況を確認しています。", kr: "배송 상황을 확인하고 있습니다." },
        awaitingReceiptPrefix: {
          jp: "商品が届きましたか？受領を確認すると投稿期間（",
          kr: "상품이 도착했나요? 수령을 확인하시면 게시 기간(",
        },
        awaitingReceiptSuffix: { jp: "日）が始まります。", kr: "일)이 시작됩니다." },
        actionConfirmReceipt: { jp: "受領を確認する", kr: "수령 확인" },
        rejectBadge: { jp: "差し戻し", kr: "반려" },
        rejectUrlPrefix: { jp: "提出URL: ", kr: "제출 URL: " },
        adminComment: { jp: "管理者コメント", kr: "관리자 코멘트" },
        msgPosted: {
          jp: "投稿を確認しました。投稿から7日後にインサイトを提出してください。",
          kr: "게시물을 확인했습니다. 게시 후 7일 뒤에 인사이트를 제출해 주세요.",
        },
        msgReviewing: { jp: "ブランドが確認中です。", kr: "브랜드가 검수 중입니다." },
        msgCompleted: {
          jp: "完了しました。振込予定をお待ちください。",
          kr: "완료되었습니다. 입금 예정을 기다려 주세요.",
        },
        thanksTitle: {
          jp: "キャンペーンにご参加いただきありがとうございます。",
          kr: "캠페인에 참여해 주셔서 감사합니다.",
        },
        labelReward: { jp: "報酬", kr: "보상" },
        yenSuffix: { jp: "円", kr: "엔" },
        labelPayer: { jp: "振込人", kr: "입금인" },
        companyName: { jp: "株式会社J-SURE", kr: "주식회사 J-SURE" },
        rejectPrefix: { jp: "未選定となりました: ", kr: "미선정되었습니다: " },
        cancelledNotice: {
          jp: "キャンセル済（同じキャンペーンに再応募はできません）",
          kr: "취소됨 (동일 캠페인에 재응모할 수 없습니다)",
        },
        actionCancel: { jp: "応募をキャンセル", kr: "응모 취소" },
      },
    },
    campaignDetail: {
      loading: { jp: "読み込み中…", kr: "불러오는 중…" },
      loadError: { jp: "読み込みに失敗しました", kr: "불러오지 못했습니다" },
      instagramFeed: { jp: "フィード", kr: "피드" },
      instagramReels: { jp: "リール", kr: "릴스" },
      recruitLabel: { jp: "募集", kr: "모집" },
      recruitCountSuffix: { jp: "名", kr: "명" },
      condLabel: { jp: "条件: ", kr: "조건: " },
      condFollower: { jp: "フォロワー数", kr: "팔로워 수" },
      condSubscriber: { jp: "登録者数", kr: "구독자 수" },
      noLimit: { jp: "制限なし", kr: "제한 없음" },
      sectionProduct: { jp: "商品", kr: "상품" },
      productLinkText: { jp: "商品ページを見る →", kr: "상품 페이지 보기 →" },
      sectionGuideline: { jp: "ガイドライン", kr: "가이드라인" },
      sectionCautions: { jp: "注意事項", kr: "주의사항" },
      viewApplications: { jp: "応募履歴を見る", kr: "응모 내역 보기" },
      ctaClosed: { jp: "募集終了", kr: "모집 종료" },
      ctaApply: { jp: "応募する", kr: "응모하기" },
      cancelledNotice: { // new — 취소한 캠페인은 재응모 불가
        jp: "この案件はキャンセル済みのため、再応募できません",
        kr: "취소한 캠페인은 다시 응모할 수 없습니다",
      },
    },
    me: {
      index: {
        title: { jp: "マイページ", kr: "마이페이지" },
        profile: { jp: "プロフィール", kr: "프로필" },
        snsAccounts: { jp: "SNSアカウント", kr: "SNS 계정" },
        snsCountSuffix: { jp: "件", kr: "개" },
        bank: { jp: "振込先口座", kr: "입금 계좌" },
        notRegistered: { jp: "未登録", kr: "미등록" },
        address: { jp: "配送先住所", kr: "배송지 주소" },
        login: { jp: "ログイン", kr: "로그인" },
        logout: { jp: "ログアウト", kr: "로그아웃" },
      },
      profile: {
        required: { jp: "必須", kr: "필수" },
        kanaError: { jp: "カナで入力", kr: "가타카나로 입력" },
        phoneError: { jp: "10~15桁", kr: "10~15자리" },
        title: { jp: "プロフィール", kr: "프로필" },
        nameLabel: { jp: "お名前", kr: "이름" },
        nameKanaLabel: { jp: "お名前 (カナ)", kr: "이름 (가타카나)" },
        phoneLabel: { jp: "電話番号", kr: "전화번호" },
        emailLabel: { jp: "メールアドレス", kr: "이메일 주소" },
        birthDateLabel: { jp: "生年月日", kr: "생년월일" },
        saving: { jp: "保存中…", kr: "저장 중…" },
        save: { jp: "保存", kr: "저장" },
      },
      bank: {
        required: { jp: "必須", kr: "필수" },
        branchCodeError: { jp: "3桁", kr: "3자리" },
        accountNumberError: { jp: "7桁", kr: "7자리" }, // new
        kanaError: { jp: "カナで入力", kr: "가타카나로 입력" },
        bankRequired: { jp: "銀行を選択", kr: "은행을 선택해 주세요" },
        saveFailed: { jp: "保存に失敗しました", kr: "저장에 실패했습니다" },
        title: { jp: "振込先口座", kr: "입금 계좌" },
        reenterAccount: {
          jp: "セキュリティのため口座番号は再入力してください",
          kr: "보안을 위해 계좌번호를 다시 입력해 주세요",
        },
        bankLabel: { jp: "銀行", kr: "은행" },
        branchName: { jp: "支店名", kr: "지점명" },
        branchCode: { jp: "支店コード (3桁)", kr: "지점 코드 (3자리)" },
        accountNumber: { jp: "口座番号", kr: "계좌번호" },
        accountHolderKana: { jp: "口座名義 (カナ)", kr: "예금주명 (가타카나)" },
        saving: { jp: "保存中…", kr: "저장 중…" },
        save: { jp: "保存", kr: "저장" },
      },
      sns: {
        atLeastOne: {
          jp: "1つ以上のSNSアカウントを追加してください",
          kr: "1개 이상의 SNS 계정을 추가해 주세요",
        },
        handleRequired: { jp: "ハンドルを入力してください", kr: "핸들을 입력해 주세요" },
        followerInvalid: { jp: "フォロワー数は数字のみ", kr: "팔로워 수는 숫자만" },
        saveFailed: { jp: "保存に失敗しました", kr: "저장에 실패했습니다" },
        title: { jp: "SNSアカウント", kr: "SNS 계정" },
        saving: { jp: "保存中…", kr: "저장 중…" },
        save: { jp: "保存", kr: "저장" },
      },
      address: {
        title: { jp: "配送先住所", kr: "배송지 주소" },
        saveFailed: { jp: "保存に失敗しました", kr: "저장에 실패했습니다" },
        saving: { jp: "保存中…", kr: "저장 중…" },
        save: { jp: "保存", kr: "저장" },
      },
    },
    auth: {
      lineReturn: {
        errorReceive: {
          jp: "ログイン情報を受信できませんでした",
          kr: "로그인 정보를 수신하지 못했습니다",
        },
        errorLogin: { jp: "ログインに失敗しました", kr: "로그인에 실패했습니다" },
        loggingIn: { jp: "LINEでログイン中…", kr: "LINE으로 로그인 중…" },
      },
      login: {
        intro: {
          jp: "LINEアカウントでログイン・新規登録ができます。",
          kr: "LINE 계정으로 로그인·회원가입할 수 있습니다.",
        },
        continueWithLine: { jp: "LINEで続行", kr: "LINE으로 계속하기" },
      },
    },
    browse: {
      loadError: { jp: "読み込みに失敗しました", kr: "불러오지 못했습니다" },
      empty: { jp: "対象のキャンペーンはまだありません", kr: "대상 캠페인이 아직 없습니다" },
    },
    notices: {
      title: { jp: "お知らせ", kr: "알림" },
    },
    notFound: {
      heading: { jp: "ページが見つかりません", kr: "페이지를 찾을 수 없습니다" },
      home: { jp: "ホームへ", kr: "홈으로" },
    },
  },
} as const;
