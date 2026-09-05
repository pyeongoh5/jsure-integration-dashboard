# 캠페인 조회 인원(관심도) 지표 설계

작성일: 2026-09-05

## 목적

- 인플루언서가 어떤 캠페인 상세를 열람했는지 기록해, 안건별 관심도를 정량화한다.
- 응모 건수만이 아니라 "본 사람 대비 응모한 비율"을 계산해 다음 캠페인 기획에 활용한다.

## 지표 정의

- **조회 인원(`viewerCount`)**: 해당 캠페인 상세를 한 번이라도 연 인플루언서 수. 같은 사람이 여러 번 봐도 1.
- **응모율(`applicationRate`)**: `전체 응모 건수 ÷ 조회 인원 × 100`. 조회 인원이 0이면 `null`.
  - 분자는 **전체 응모**(승인/탈락/취소 포함). 측정 대상은 인플루언서의 반응이지 어드민의 선발 결과가 아니다.
  - 열린 항목: 이 분자 정의는 요건 작성자 확인이 필요하다. 승인 기준으로 바꿔야 하면 집계 한 줄만 수정하면 된다.

PV(순수 조회 횟수)는 집계하지 않는다. 한 사람이 10번 본 캠페인이 10명이 본 캠페인처럼 보이는 왜곡을 없애고, 응모율 분모를 신뢰할 수 있게 하기 위해서다. 중복 제거 로직 자체가 사라지는 부수 효과도 있다.

## 데이터 모델

```prisma
model CampaignView {
  campaignId   String
  influencerId String

  campaign   Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Cascade)

  @@id([campaignId, influencerId])
  @@index([campaignId])
  @@map("campaign_views")
}
```

- 복합 PK가 곧 중복 제거 장치다. 별도 id, 카운터, 시각 컬럼을 두지 않는다.
- 캠페인/인플루언서 삭제 시 Cascade 정리.
- 마이그레이션은 테이블 신규 추가뿐 — 기존 데이터에 영향이 없다.
- 조회 시각이 필요해지면 그때 `viewedAt` nullable 컬럼을 추가한다(현 요건 범위 밖).

## 기록 경로

`InfluencerCampaignsService.detail()`에서 캠페인 조회가 성공한 직후 1회:

```ts
// 인플루언서당 캠페인 1행. 재조회는 무시되므로 별도 중복 제거 로직이 필요 없다.
await this.prisma.$executeRaw`
  INSERT INTO campaign_views (campaign_id, influencer_id)
  VALUES (${campaignId}, ${influencerId})
  ON CONFLICT DO NOTHING`;
```

- `UPDATE`가 없어 동시 조회 경합이 없다.
- 기록 실패는 `.catch()`로 삼키고 로그만 남긴다. 조회 기록은 유실돼도 되지만 상세 조회는 막히면 안 된다.
- 상세 엔드포인트는 이미 `InfluencerJwtAuthGuard`로 보호되어 있어 익명 조회는 존재하지 않는다.
- `client-web` 변경 없음. 전용 엔드포인트를 만들지 않으므로 프런트에 트래킹 코드가 들어가지 않는다.

## 집계

`campaignView.groupBy({ by: ["campaignId"], where: { campaignId: { in: ids } }, _count: true })` 한 번.
캠페인당 행 수가 관심 인플루언서 수 수준이라 목록/리포트 집계가 가볍다.

## 어드민 노출

### `packages/shared`

- `CampaignResponse`에 `viewerCount: z.number().int().nonnegative()` 추가.
- `CampaignReportRow`에 `viewerCount`, `applicationRate: z.number().nullable()` 추가.
- `CampaignReportSortKeySchema`에 `viewerCount`, `applicationRate` 추가.

### `apps/api`

- `campaigns.service.ts` `loadCounts()` — 기존 응모 카운트 집계 옆에 조회 인원 `groupBy` 1회 추가.
- `admin-reports.service.ts` `campaignReports()` — 같은 집계 1회 추가 후 행마다 `viewerCount`, `applicationRate` 계산. `compareRows()`에 두 정렬 키 추가.

### `apps/admin-web`

- `CampaignCardFooter.tsx` — 진행률 문구 옆에 조회 인원 표기. i18n 키 `domains.campaign.card.viewerCount` 신규(ko/en/ja).
- `Reports/index.tsx` — 컬럼 정의 배열에 두 컬럼 추가. 정렬·표시는 기존 메커니즘 그대로. i18n 키 `pages.reports.columns.viewerCount`, `pages.reports.columns.applicationRate` 신규.

용어: 원 요건의 "조회수 / 조회 1,250회" 표기는 실제 의미에 맞춰 **"조회 인원 / 조회 1,250명"** 으로 쓴다.

## 엑셀 다운로드

리포트 다운로드는 현재 선택한 캠페인마다 참여자 시트를 1장씩 만든다. 여기 **맨 앞에 "캠페인 요약" 시트 1장**을 추가한다.

- 내용: 선택된 캠페인들의 리포트 행(조회 인원·응모율 포함)을 화면 테이블과 같은 컬럼 구성으로.
- 컬럼 정의와 라벨은 화면 테이블의 컬럼 배열/i18n 키를 재사용한다. 화면에 컬럼이 늘면 시트에도 따라 늘어난다.
- 정렬은 화면에서 보고 있던 순서 그대로.
- 기존 참여자 시트는 손대지 않는다.

캠페인 관리 화면에는 현재 CSV/엑셀 추출 기능이 없고, 요약 시트와 내용이 겹치므로 신규 추가하지 않는다. 카드에 숫자가 표기되므로 화면 확인은 가능하다.

## 테스트

- `influencer-campaigns.service.spec.ts`: (1) 첫 조회 시 행 생성, (2) 같은 인플루언서 재조회 시 행 수 불변.
- `admin-reports.service.spec.ts`: 조회 인원과 응모율 계산, 조회 인원 0일 때 `applicationRate`가 `null`.

## 배포 대상

- `packages/shared` 변경 → `api` 재배포 필요(Railway).
- `apps/api` → Railway 배포 + 마이그레이션 적용(테이블 추가만).
- `apps/admin-web` → Vercel 배포.
- `apps/client-web` → 변경 없음, 배포 불필요.

## 사이드이펙트

- `CampaignCardFooter`는 캠페인 관리 카드 전용이라 영향 범위가 한정된다.
- `CampaignResponse` / 리포트 응답의 필드 추가는 하위 호환이다.
- 인플루언서 상세 API에 INSERT 1회가 늘어난다. 실패를 삼키므로 상세 조회 실패로 이어지지 않는다.
