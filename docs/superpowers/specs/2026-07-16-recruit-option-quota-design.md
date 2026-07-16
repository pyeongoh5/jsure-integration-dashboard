# 서브타입 옵션별 모집 정원 (인스타 피드/릴스 분리) 설계

- 상태: 설계 확정, 구현 미착수
- 날짜: 2026-07-16

## 배경

현재 모집 인원(`CampaignRecruit.recruitCount`)은 서브타입 단위 하나다. INSTAGRAM은
`subTypeOptions`(FEED/REELS)로 허용 포스트 타입만 지정하고, 응모자가 하나를 골라
`CampaignApplication.instagramPostType`에 저장한다. 정원 체크·마감 판정·인원 표시는
전부 서브타입 단위 count다.

운영 요청: 인스타그램은 피드/릴스를 구분해 "피드 30명 + 릴스 10명"처럼 옵션별로
정원을 받고 싶다.

## 확정된 요구사항

1. **통합/분리 선택 가능** — 캠페인마다 기존처럼 서브타입 통합 인원으로 받을 수도,
   옵션별 분리로 받을 수도 있다.
2. **보수는 서브타입 단위 유지** — 개별보수(PER_SUBTYPE)여도 피드/릴스 보수는 나누지
   않는다.
3. **응모는 옵션 1개 선택** — 한 인플루언서는 피드 또는 릴스 중 하나만 (현행과 동일).
4. 모델은 INSTAGRAM 전용이 아니라 **서브타입 옵션 일반**으로 설계한다. 미래에
   QOO10(LIPS/@cosme 채널) 등에서 재사용 가능해야 한다.

## 설계

### 데이터 모델

```prisma
// recruit가 모집하는 옵션과 그 옵션의 정원.
// 행이 있으면 "옵션별 분리 모집", 없으면 통합 모드(기존 캠페인 그대로).
model CampaignRecruitOption {
  id           String          @id @default(cuid())
  recruitId    String
  recruit      CampaignRecruit @relation(fields: [recruitId], references: [id], onDelete: Cascade)
  option       String          // subTypeOptions 값 축: "FEED" | "REELS" | (미래: "LIPS" | "ATCOSME")
  recruitCount Int
  @@unique([recruitId, option])
  @@map("campaign_recruit_options")
}

// 응모가 선택한 옵션. instagramPostType 컬럼을 대체·일반화.
model CampaignApplicationOption {
  id            String              @id @default(cuid())
  applicationId String
  application   CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  subType       CampaignSubType
  option        String
  @@unique([applicationId, subType, option])
  @@map("campaign_application_options")
}
```

- `CampaignApplication.instagramPostType` **제거**. 기존 값은
  `CampaignApplicationOption(INSTAGRAM, 값)` 행으로 백필 후 컬럼 drop.
- 분리 모드 시 `recruit.recruitCount` = 옵션 정원 **합계로 저장 유지** → 캠페인 카드
  인원 합산, 전체 마감 판정(`isCampaignClosed`), Apply 인원 표시 등 기존 참조 무수정.
- `recruit.subTypeOptions: string[]` 배열은 이번엔 유지. 추후 `recruitCount`를
  nullable로 풀면 이 테이블이 허용 옵션 목록 자체를 흡수할 수 있다(행 = 허용 옵션,
  정원은 선택 속성).

### 이름/구조 결정 이력

- `A안: recruit에 feed/reels 전용 컬럼` — 인스타 특수적, 확장성 없음 → 기각.
- `B안: recruit 행을 (subType, option)으로 분리` — 서브타입 단위 값(보수·팔로워
  조건·상품가)이 행 간 중복되고 "서브타입당 recruit 1행" 가정 전체에 파급 → 기각.
- `CampaignRecruitOptionQuota` → `CampaignRecruitQuota` → **`CampaignRecruitOption`**:
  응모 쪽 `CampaignApplicationOption`과 대칭이고, 향후 subTypeOptions 배열 흡수
  경로와 맞는 이름.

### 검증 규칙 (서버)

- 옵션 정원 저장 시: `option ∈ recruit.subTypeOptions`, 각 정원 ≥ 1, 합계 =
  `recruitCount`(자동 계산).
- 응모 시: **옵션 선택형 서브타입(현재 INSTAGRAM만)** 참여 시 옵션 1개 필수,
  `option ∈ subTypeOptions` (현행 instagramPostType 검증의 일반화).
  주의: QOO10의 `subTypeOptions`(LIPS/@cosme)는 캠페인이 강제하는 요구 채널이라
  응모 선택 대상이 아님 — 선택형 여부는 서브타입별 상수로 구분한다.
- 승인 시: 서브타입 정원 체크(현행 유지) + 옵션 정원 행이 있는 recruit이면 응모의
  해당 옵션으로 `count(applications where options some {subType, option}, status in
  SLOT_CONSUMING_STATUSES)` vs 옵션 정원. 하나라도 초과면 승인 불가(기존 정책 동일).
- 정원 체크 시점은 현행대로 **승인 시에만** (응모 단계에서는 막지 않음).

### API / DTO

- `CreateApplicationRequest.instagramPostType` → `options: { subType, option }[]`.
- 응답 DTO(인플루언서·어드민): `selectedOptions: { subType, option }[]` 노출,
  recruit에 `options: { option, recruitCount }[]` 노출.
- 화면 라벨(admin 피드/릴스 표기, client `Instagram - FEED` 태그)은 selectedOptions
  에서 INSTAGRAM 옵션을 찾아 렌더 — 데이터 바인딩 치환.

### 화면

- **admin 캠페인 폼(유일한 실질 UI 작업)**: INSTAGRAM recruit에 "인원 통합 / 타입별"
  토글. 타입별 선택 시 허용 옵션마다 인원 입력, 합계 자동 표시.
- 나머지 화면(client 응모 폼의 FEED/REELS 라디오, 응모 카드 태그, admin 테이블 라벨,
  카드 인원 합산)은 **UI 변화 없음** — DTO 변경에 따른 바인딩 치환만.
- 선택 사항(이번 범위에서 생략 가능): client 캠페인 상세에 "피드 30 · 릴스 10" 표기,
  응모 폼에서 옵션별 마감 비활성(정원을 승인 시에만 체크하는 정책이면 불필요).

### 미래 요구 대응 검토

- **피드/릴스 동시 참여**: `CampaignApplicationOption` 유니크가
  `(applicationId, subType, option)`이라 행 추가로 표현 가능. 정원 체크도 그대로.
  걸림돌은 `SubmittedPost @@unique([applicationId, subType])`(서브타입당 제출 1개
  가정 → option 컬럼 추가 필요)와 보수 정책(동시 참여 시 보수 배수) — 둘 다 그때
  국소 확장 가능하며 이번 구조가 막지 않는다.
- **QOO10 채널별 모집**: 캠페인이 채널을 강제하는 현행에서 "채널 선택 + 채널별
  정원" 모델로 바뀌면 스키마 변경 없이 두 테이블로 수용.

### 테스트

- 승인 정원: 옵션 초과 시 거부(한국어 메시지에 옵션 라벨), 통과 케이스.
- 응모 검증: 옵션 미선택/허용 외 옵션 거부, 백필된 기존 응모 조회.
- 캠페인 폼: 분리 모드 검증(합계·옵션 범위).

### 마이그레이션

1. 두 테이블 생성.
2. `instagramPostType IS NOT NULL`인 응모를 `campaign_application_options`
   (INSTAGRAM, 값) 행으로 백필.
3. `instagramPostType` 컬럼 drop.
4. `CampaignRecruitOption`은 신규 기능 — 백필 없음(기존 캠페인 = 통합 모드).

## 구현 순서 (다음 세션 가이드)

1. Prisma 스키마 + 마이그레이션(백필 포함)
2. shared 타입 (요청/응답 DTO, 폼 스키마 검증)
3. API: 응모 생성 옵션 검증 → 승인 옵션 정원 체크 → 캠페인 저장 검증 → DTO 매핑
4. admin-web 캠페인 폼 토글 + 테이블 라벨 바인딩 치환
5. client-web 응모 폼 요청 필드 + 카드/상세 라벨 바인딩 치환
6. spec 갱신 + `pnpm -r typecheck` / api jest
