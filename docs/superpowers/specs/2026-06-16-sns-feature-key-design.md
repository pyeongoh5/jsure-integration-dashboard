# SNS 활성 플래그(Feature Key) 도입

## 배경

현재 `SnsType` enum은 `INSTAGRAM`, `TIKTOK`, `X`, `YOUTUBE` 4종을 포함하지만, 초기 운영은 **Instagram과 X**만 제공한다. TikTok·YouTube는 추후 재오픈 예정이므로 enum·DB 스키마는 그대로 두고, **빌드 타임 상수**로 활성 목록을 관리하는 feature-key 패턴을 도입한다.

## 목표

- 활성 SNS 목록을 한 곳에서 토글 가능한 단일 진실의 원천(SSOT)으로 관리한다.
- 차단 범위: **신규 입력, 표시·선택·필터까지 전부**. 기존 데이터 렌더링은 안전하게 유지한다.
- `SnsType` enum에 새 항목이 추가되면 컴파일 타임에 누락을 잡는다.

## 비목표

- 런타임 토글(env 변수 등)은 지원하지 않는다 — 변경 시 코드 푸시·빌드 필요.
- DB enum·Prisma 스키마 변경 없음.
- 과거 데이터 마이그레이션 없음 (현재 TikTok/YouTube 데이터 부재).

## 설계

### 1. SSOT — `packages/shared/src/types/influencer.ts`

```ts
export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

/** SNS 활성 플래그. 재오픈 시 이 객체만 수정한다. */
export const SNS_ENABLED: Record<SnsType, boolean> = {
  INSTAGRAM: true,
  TIKTOK: false,
  X: true,
  YOUTUBE: false,
};

export const isEnabledSnsType = (snsType: SnsType): boolean =>
  SNS_ENABLED[snsType];

export const ENABLED_SNS_TYPES: readonly SnsType[] = (
  Object.keys(SNS_ENABLED) as SnsType[]
).filter(isEnabledSnsType);

export const EnabledSnsTypeSchema = z.enum(
  ENABLED_SNS_TYPES as [SnsType, ...SnsType[]],
);
export type EnabledSnsType = z.infer<typeof EnabledSnsTypeSchema>;
```

**Record 채택 이유:** `SnsType` enum이 확장될 때 `Record<SnsType, boolean>`은 누락된 키를 타입 에러로 잡아준다. 배열 화이트리스트는 빠뜨려도 통과한다.

### 2. 입력 경계 — API 스키마 교체

**신규 작성·수정 경로의 `SnsTypeSchema` → `EnabledSnsTypeSchema`:**

- 인플루언서 SNS 계정 등록(`InfluencerSnsAccountInputSchema`의 `snsType`)
- 캠페인 생성/수정의 모집 SNS(`SnsRecruit`의 `snsType`, `appliedSnsTypes`, `excludedSnsTypes`)
- 응모 작성·게시물 제출 등 클라이언트에서 SNS를 선택하는 모든 경로

**유지(기존 데이터 안전 조회):** 읽기 응답 스키마, 관리자 필터·검색 입력, CSV 출력 등 **표시·집계 목적의 SnsType 필드**는 `SnsTypeSchema` 유지.

판단 기준: "이 필드 값이 새로 생성되는가?" → Yes면 `EnabledSnsTypeSchema`, No(기존값 표시·필터)면 `SnsTypeSchema`.

### 3. UI — 선택지·탭 필터링

다음 위치의 옵션 배열에서 `isEnabledSnsType`로 필터링하거나 `ENABLED_SNS_TYPES`로부터 생성한다:

**admin-web:**
- `domains/campaign/components/SnsTypeChips.tsx`
- `domains/campaign/components/SnsRecruitList.tsx`
- `pages/Influencers/index.tsx`(SNS 필터 옵션)

**client-web:**
- `domains/campaign/components/SnsTabBar.tsx`
- `domains/application/components/ApplicationFilters.tsx`
- `pages/Signup/Sns.tsx`(가입 시 SNS 입력)
- `pages/Me/Sns.tsx`(SNS 계정 관리)

**라벨·아이콘 매핑 dict(`X: "X"` 등)는 4종 그대로 유지.** 만약 과거 데이터가 렌더링되어야 할 경우(현재는 없지만 안전망) 깨지지 않게 한다. UI에서 차단되는 건 **선택지·탭·필터 옵션**이지, 표시 컴포넌트 자체가 아니다.

### 4. 재오픈 절차

TikTok/YouTube를 다시 켤 때:

1. `SNS_ENABLED`의 해당 키를 `true`로 변경
2. 빌드·배포

그 외 변경은 필요 없다. `EnabledSnsTypeSchema`·`ENABLED_SNS_TYPES`·UI 옵션이 모두 자동 반영된다.

## 영향 범위 요약

| 영역 | 변경 |
|------|------|
| `packages/shared/src/types/influencer.ts` | `SNS_ENABLED`, `isEnabledSnsType`, `ENABLED_SNS_TYPES`, `EnabledSnsTypeSchema` 추가 |
| 입력 스키마 (캠페인·인플루언서·응모·게시물) | 작성·수정 경로의 `SnsTypeSchema` → `EnabledSnsTypeSchema` |
| 표시·필터 스키마 | 변경 없음 |
| admin-web UI 옵션 3곳 | 옵션 배열을 `ENABLED_SNS_TYPES` 기반으로 필터링 |
| client-web UI 옵션 4곳 | 동상 |
| DB / Prisma | 변경 없음 |

## 검증 기준

- 비활성 SNS(`TIKTOK`, `YOUTUBE`)를 입력으로 전송하면 API가 zod 검증 단계에서 거부한다.
- admin·client 모든 SNS 선택 UI에 Instagram·X만 보인다.
- 기존 SNS 표시 컴포넌트(라벨·아이콘 매핑)는 4종 모두 처리 가능한 상태로 유지된다.
- `SnsType`에 새 항목을 추가하는 가상 시나리오에서, `SNS_ENABLED`에 해당 키를 추가하지 않으면 TypeScript 컴파일 에러가 난다.
