# 캠페인 recruit 별 "응모 필수" 지정

## Context

현재 SNS·SIMPLE_REVIEW 캠페인은 여러 서브타입 recruit 을 등록할 수 있고, 인플루언서는 그 중 자격이 되는 것 중 원하는 것을 자유롭게 골라 응모한다. 광고주 입장에서는 "이 캠페인엔 반드시 INSTAGRAM 계정을 걸어야 한다" 같은 최소 요구를 강제할 수단이 없어, 응모자가 X 만 걸고 INSTAGRAM 은 건너뛰는 사례를 막지 못한다.

이번 변경은 recruit 별 `isRequired` 플래그를 도입해, 캠페인 생성 시 필수로 참여해야 하는 서브타입을 지정할 수 있도록 하고, Apply 화면에서 필수 서브타입은 자동 선택 + 해제 불가로 노출한다.

## 결정 사항 (사용자 확인)

- 필수 서브타입 자격(최소 팔로워 등) 미달 시 → **응모 자체 불가** (CTA 비활성 + 안내 배너).
- 적용 카테고리: **SNS + SIMPLE_REVIEW**. FAKE_PURCHASE 는 단일 서브타입(QOO10) 이라 무의미하므로 UI 노출 안 함, Zod 로 `isRequired=true` 지정 방어.
- 접근: recruit 테이블에 컬럼 하나 추가 (`isRequired: boolean, default false`) — campaign 레벨 별도 배열 저장은 하지 않음.

## 데이터 모델

**`apps/api/prisma/schema.prisma`**
- `CampaignRecruit` 에 컬럼 추가:
  ```prisma
  isRequired Boolean @default(false)
  ```
- 새 마이그레이션 `20260714150000_add_recruit_is_required` 에 `ALTER TABLE "CampaignRecruit" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false`.

**`packages/shared/src/types/campaign.ts`**
- `CampaignRecruitSchema` 에 `isRequired: z.boolean().default(false)` 추가.
- `CampaignRecruitInputSchema` 도 동일하게 확장.
- `refineRecruitsByCategory` 에 규칙 추가: `category === "FAKE_PURCHASE"` 인데 `recruit.isRequired === true` 인 row 가 있으면 issue (`"가구매 캠페인에서는 필수 여부를 지정할 수 없습니다"`).
- `InfluencerCampaignCardSchema` / `InfluencerCampaignDetailSchema` 의 recruits 배열에도 `isRequired` 포함 (프론트가 참조).

**하위 호환** — 기본값 false 라 기존 캠페인/recruit 자동으로 옵션. 데이터 손실 없음.

## Admin 캠페인 폼

**대상** — `apps/admin-web/src/domains/campaign/components/RecruitList.tsx`

- SNS 브랜치와 SIMPLE_REVIEW 브랜치의 각 recruit 카드에 체크박스 추가. FAKE_PURCHASE 브랜치는 렌더링 스킵.
- 배치: 자격 조건 입력(최소 팔로워/모집 인원) 아래.
- 라벨: **"응모 필수 (인플루언서가 해제할 수 없음)"**
- 상태 변화 시 `onChange({ ...recruit, isRequired: next })` 로 recruit 배열 갱신.
- 기존 톤앤매너 유지: `.subLabel`, `.snsFields` 등 이미 사용되는 클래스와 스페이싱을 그대로 따르고 새 스타일 파일을 만들지 않는다.
- 편집 모드 진입 시 서버가 내려주는 `isRequired` 값으로 초기 세팅.

## Apply 페이지 UX

**대상** — `apps/client-web/src/pages/Apply/index.tsx`

**자동 선택 + 잠금**
- `useEffect(campaign.data)` 초기화에서 `recruits.filter(r => r.isRequired).map(r => r.subType)` 를 `selectedSns` 초기 상태에 합침.
- 각 recruit 렌더링 시 `r.isRequired` 이면 `<input type="checkbox" checked disabled>` 로 강제.
- `toggleSns` 함수 진입부에 방어: `if (recruit.isRequired) return;` (disabled 이지만 안전벨트).
- 시각적 힌트: 서브타입 이름 옆에 "필수" 뱃지 (기존 `pages.apply.appliedTag`/`excludedTag` 와 동일한 톤·크기).

**자격 미달 처리** (Q1 답변)
- `qualifying` 계산 이후 `requiredSubTypes.filter(sub => !qualifying.includes(sub))` 을 계산.
- 하나라도 있으면 CTA 비활성 + 안내 배너 노출.
- i18n 키 신설: `pages.apply.requiredNotQualifiedPrefix` + suffix (예: "이 캠페인은 <서브타입 목록> 응모가 필수이지만 자격 조건을 만족하는 계정이 없습니다").
- 자격 미달 배너와 기존 `noQualifying` 배너는 상호 배타 — required 미달이 우선.

**i18n 키** — `pages.apply.requiredBadge` ("필수" / "必須"), `requiredNotQualifiedPrefix`/`Suffix`.

## 백엔드 검증

**대상** — `apps/api/src/influencer-applications/influencer-applications.service.ts` `create`

프론트가 잠가도 API 직접 호출은 방어해야 함.

1. 캠페인 recruits 로부터 required set 계산.
2. 요청 `subTypes` 이 required set 을 포함하지 않으면:
   ```
   400 { code: "REQUIRED_SUBTYPE_MISSING",
         message: "필수 참여 서브타입이 응모에 포함되지 않았습니다" }
   ```
3. required set 의 각 서브타입이 자격 조건을 만족하는지 재검증 (기존 SNS 자격 로직 재사용). 하나라도 미달이면:
   ```
   400 { code: "REQUIRED_SUBTYPE_NOT_QUALIFIED",
         message: "필수 참여 서브타입의 자격 조건을 만족하지 않습니다" }
   ```
4. SIMPLE_REVIEW 는 자격 조건이 사실상 없음(minFollowers 0)이므로 (3) 은 통과. 존재 검증만 유효.

## 영향 없는 영역

- 라인 메시지, 정산 흐름, 배송 흐름, 검토(drafts) 페이지: `isRequired` 를 참조하지 않음.
- 기존 응모 데이터: 추가 컬럼이 nullable 이 아닌 default false 라 마이그레이션 후 자동으로 "옵션" 처리됨.

## 테스트

- **shared campaign spec (신규)** — `CampaignRecruitInputSchema` refine 확인:
  - FAKE_PURCHASE + `isRequired=true` → issue.
  - SNS + `isRequired=true` 정상 통과.
- **`campaigns.service.spec.ts`** — 새 recruit 저장/조회 시 `isRequired` 유지.
- **`influencer-applications.service.spec.ts`** — `create()` 신규 케이스:
  - required 서브타입 누락 → `REQUIRED_SUBTYPE_MISSING`.
  - required 서브타입에 자격 미달 → `REQUIRED_SUBTYPE_NOT_QUALIFIED`.
  - required + optional 조합 정상 응모.

## 파일 요약

| 앱 | 파일 | 변경 |
|---|---|---|
| api | `prisma/schema.prisma`, 신규 마이그레이션 | `CampaignRecruit.isRequired` 컬럼 |
| shared | `types/campaign.ts` | 스키마·refine·응답 스키마 확장 |
| api | `influencer-applications.service.ts` | required 검증 2종 |
| admin-web | `campaign/components/RecruitList.tsx` | 체크박스 |
| client-web | `pages/Apply/index.tsx` | 자동 선택·잠금·미달 배너·CTA 게이팅 |
| i18n | `messages.ts` | `requiredBadge`, `requiredNotQualifiedPrefix/Suffix` |

## 검증 방법

1. Prisma 마이그레이션 배포 (`pnpm --filter @jsure/api prisma:deploy`) → `npx prisma generate`.
2. 관리자: SNS 캠페인 생성 시 INSTAGRAM 를 필수로 지정 → 저장 → 편집 재진입 시 체크 유지 확인.
3. 인플루언서 A (INSTAGRAM 자격 충족): Apply 화면에서 INSTAGRAM 자동 선택 + 잠금 상태 확인, X 는 선택 가능. 응모 성공.
4. 인플루언서 B (INSTAGRAM 자격 미달): Apply 화면에서 안내 배너 노출 + CTA 비활성 확인.
5. curl 로 API 에 required 를 뺀 요청 전송 → 400 `REQUIRED_SUBTYPE_MISSING` 응답 확인.
6. 자동 테스트: `pnpm --filter @jsure/api test`.
