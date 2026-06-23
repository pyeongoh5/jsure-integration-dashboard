# 게시물 반려 LINE 알림 + 다음날 리마인드

## 배경

어드민이 인플루언서의 제출 게시물을 반려할 때, 현재는 LINE 알림이 발송되지 않는다. 인플루언서는 어드민 화면을 보지 못하므로 반려 사실과 수정 요청을 받지 못해 재제출이 지연된다.

## 목표

- 게시물 반려 처리(`rejectSubmittedPost`) 직후, 해당 인플루언서에게 반려 사유·재제출 기한·재제출 페이지 링크를 담은 LINE 메시지를 발송한다.
- 반려된 게시물이 다음 날 JST 기준으로도 여전히 재제출되지 않은 경우, 매일 JST 09:00 정기 실행되는 리마인더에서 리마인드 LINE 메시지를 1회 발송한다.

## 비목표

- DB 스키마·게시물 모델·캠페인 모델 변경 없음.
- 어드민 UI에서 별도 입력 필드 추가 없음(반려 사유는 기존 입력 그대로 사용).
- 이메일·SMS 등 LINE 외 채널 발송 없음.
- 본인이 LINE 연동을 하지 않은 인플루언서에 대한 별도 대체 알림 없음(기존 알림과 동일하게 silent skip).

## 설계

### 1. 환경 변수 — 재제출 페이지 호스트

기존 `LineMessagingService.applicationUrl(applicationId)`이 `${APP_BASE_URL}/applications/${applicationId}` 형태를 만들어 다른 알림에서 이미 사용 중이다. 본 작업은 이 헬퍼를 재사용한다.

코드 변경 없음. 운영 작업으로 환경별 값만 설정한다.

- local/dev: `apps/api/.env`의 `APP_BASE_URL=http://localhost:5174`
- production: 배포 환경변수 `APP_BASE_URL=https://jsure-integration-dashboard-client.vercel.app`

`apps/api/.env.example`이 존재하면 해당 키를 문서화하는 줄 추가.

### 2. 재제출 기한 정책

상수 `POST_REJECTION_RESUBMIT_DAYS = 1`을 `apps/api/src/admin-applications/admin-applications.service.ts` 상단에 정의. 반려 시점 + 1일(24시간 후)을 메시지의 "재제출 기한"·"최종 기한"으로 표시한다.

날짜 포맷은 ja-JP 로컬의 `M月D日` 형식(예: `7月23日`). 시간대는 JST(`Asia/Tokyo`) 기준으로 일자만 표시.

### 3. 반려 직후 알림 — `LineMessagingService.notifyPostRejected`

기존 `notifyShipped`/`notifyDelivered` 등의 패턴을 따라 Flex bubble로 빌드한다. `**...**` 마커는 기존 `buildBubble`이 bold span으로 처리한다.

```ts
async notifyPostRejected(args: {
  influencerId: string;
  applicationId: string;
  campaignTitle: string;
  rejectReason: string;
  resubmitDeadlineAt: Date;
}): Promise<void>
```

메시지 본문(인용 표시자는 실제 값으로 치환):

```
**⚠️【要確認】キャンペーン投稿 修正・再提出のお願い ⚠️**

お世話になっております。
「{캠페인명}」の投稿URLをご提出いただき、誠にありがとうございます。

ご提出いただいたコンテンツを運営事務局にて確認いたしましたところ、誠に恐縮ではございますが、一部**修正および補完が必要な箇所が見つかり、再審査処理**とさせていただきました。

大変お手数ですが、下記の修正理由をご確認いただき、ご対応いただけますようお願いいたします。🙏

📝 **修正ご依頼内容**
- **修正の理由:** {반려 사유}
- **再提出期限:** {M月D日} までに修正の上、URLの再提出をお願いいたします。

🔗 **確認および再提出はこちら:** {신청 페이지 링크}

※ガイドラインに沿って投稿を修正いただいた後、上記のリンクより**必ずURLの再提出**をお願いいたします。再提出が完了した時点で、最終検収へと進みます。

お手数をおかけして大変申し訳ございませんが、ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00
```

altText는 `【要確認】「{campaignTitle}」の投稿修正のお願い`로 둔다.

### 4. 반려 처리에서 알림 호출

`apps/api/src/admin-applications/admin-applications.service.ts`의 `rejectSubmittedPost(postId, reviewerId, comment)` 메서드에서 DB 반려 처리(트랜잭션) 직후, 다음 정보를 모아 `notifyPostRejected`를 호출한다.

- `influencerId` — post.application.influencerId
- `applicationId` — post.applicationId
- `campaignTitle` — post.application.campaign.title
- `rejectReason` — 방금 작성된 rejection의 comment
- `resubmitDeadlineAt` — `new Date(now.getTime() + POST_REJECTION_RESUBMIT_DAYS * DAY_MS)`

알림 호출은 기존 `notifyX` 패턴과 동일하게 await 하되, LINE 측 실패는 `pushToInfluencer` 내부에서 silent로 처리되어 비즈니스 로직을 차단하지 않는다.

### 5. 다음날 리마인드 — `LineRemindersService.runPostRejectionReminders`

기존 `LineRemindersService`(`apps/api/src/influencer-auth/line-reminders.service.ts`)의 `runDaily()` 안에서 `runPostingReminders`·`runInsightReminders` 이후에 `runPostRejectionReminders()`를 호출한다. 매일 JST 09:00 1회 실행.

**조건:**
- `SubmittedPost.reviewStatus === "REJECTED"` 이고
- 해당 게시물의 가장 최근 `SubmittedPostRejection.rejectedAt`의 **JST 일자 == 어제(today - 1일)**

이 시간 == 조건(기존 `runPostingReminders`의 `remainingDays` 패턴과 동일)이라, 인플루언서가 재제출해서 상태가 다른 값으로 바뀌면 자연스럽게 스킵되고, 다음날 이후로는 일자가 어긋나서 더 이상 발송되지 않는다. "리마인드 완료" 플래그용 컬럼은 필요 없다.

**메시지 — `LineMessagingService.notifyPostRejectionReminder`:**

```ts
async notifyPostRejectionReminder(args: {
  influencerId: string;
  applicationId: string;
  campaignTitle: string;
  rejectReason: string;
  finalDeadlineAt: Date;
}): Promise<void>
```

`finalDeadlineAt`은 가장 최근 `rejectedAt + POST_REJECTION_RESUBMIT_DAYS * 1일`을 그대로 전달(즉, 최초 반려 시점이 어제이므로 오늘이 마감일).

본문(인용 표시자는 실제 값으로 치환):

```
**🚨【再送】キャンペーン投稿修正のお願い 🚨**

お世話になっております。
「{캠페인명}」の修正ご依頼につきまして、まだ再提出が確認できていないため再度ご連絡いたしました。

🔹 **修正の理由:** {반려 사유}
🔹 **最終期限:** **{M月D日} まで（期限厳守）**

🔗 **修正・再提出はこちら:** {신청 페이지 링크}

※ 期限内に修正およびURLの再提出が確認できない場合、報酬の支給制限やペナルティが科される場合がございます。必ずご確認の上、ご対応をお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00
```

altText는 `【再送】「{campaignTitle}」の修正・再提出のお願い`.

### 6. 데이터 흐름 요약

```
[admin reject] ──► rejectSubmittedPost
                      ├─ SubmittedPost.reviewStatus = REJECTED
                      ├─ SubmittedPostRejection.create(comment, rejectedAt)
                      └─ line.notifyPostRejected(...)   ── 즉시 발송

[JST 09:00 daily cron] ──► runDaily
                              └─ runPostRejectionReminders
                                   ├─ 최신 rejectedAt JST 일자 == today-1
                                   ├─ reviewStatus 여전히 REJECTED
                                   └─ line.notifyPostRejectionReminder(...)
```

### 7. 영향 범위

| 영역 | 변경 |
|------|------|
| `apps/api/src/influencer-auth/line-messaging.service.ts` | `notifyPostRejected`, `notifyPostRejectionReminder` 메서드 추가. `M月D日` 포맷 헬퍼 1개 추가(또는 인라인) |
| `apps/api/src/admin-applications/admin-applications.service.ts` | `POST_REJECTION_RESUBMIT_DAYS = 1` 상수, `rejectSubmittedPost`에서 알림 호출 |
| `apps/api/src/influencer-auth/line-reminders.service.ts` | `runPostRejectionReminders` 추가, `runDaily()`에서 호출 |
| `apps/api/.env.example`(존재 시) | `APP_BASE_URL` 키 문서화 |
| 배포 환경변수 | production에 `APP_BASE_URL=https://jsure-integration-dashboard-client.vercel.app` 설정(런타임 작업) |

Prisma 스키마·DB·캠페인·기존 알림 메서드·UI는 변경 없음.

### 8. 검증 기준

- 게시물 반려 직후, 인플루언서의 LINE으로 `notifyPostRejected` 메시지가 도착한다(LINE 미연동 인플루언서는 silent skip).
- 메시지의 `재제출 기한`은 반려 시점 다음 날의 JST 일자(`M月D日`).
- 메시지의 재제출 링크는 환경별로 정확한 호스트(`APP_BASE_URL`)를 가리킨다.
- 반려된 게시물이 다음 날까지 재제출되지 않으면, JST 09:00에 `notifyPostRejectionReminder`가 발송된다.
- 인플루언서가 재제출하여 `reviewStatus`가 `PENDING`/`APPROVED`로 바뀌면, 다음 날 리마인드는 발송되지 않는다.
- LINE 토큰 미설정·LINE API 실패는 비즈니스 로직(반려 처리)을 차단하지 않는다(기존 `pushToInfluencer` 동작 그대로).
