# PR 4 — Frontend Domain Modules Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 두 앱의 lib/api/*, 페이지·컴포넌트에 분산된 비즈니스 로직을 `src/domains/<domain>/` 구조로 통합한다. **외관·동작 동일 유지.**

**Architecture:** 도메인 단위로 다음 구조 생성:
```
src/domains/<domain>/
  api.ts        # axios 래퍼 (기존 lib/api/<domain>.ts 이동)
  hooks.ts      # react-query 훅 (페이지에서 직접 useQuery 호출하던 패턴 추출)
  utils.ts      # 순수 함수 (isEnded, deriveDisplayStage, formatPeriod 등)
  types.ts      # @jsure/shared 재-export + 화면 전용 타입
  components/   # 도메인 컴포넌트 (CampaignCard, ApplicationStepper 등)
  index.ts      # 외부 노출 인터페이스 (barrel)
```

페이지는 `@/domains/<domain>` 의 barrel 하나만 import.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md) 섹션 4, 10번 PR 4.

**불변 조건:**
- 외관·동작 동일
- 도메인 모듈 내부 파일을 외부에서 직접 import 금지 (PR 1의 ESLint 룰이 강제)
- 도메인 간 의존은 barrel만 통해 (양방향 금지)

---

## 도메인 식별

### client-web
| 도메인 | 포함 자산 |
|---|---|
| `campaign` | `lib/api/campaigns.ts`, `components/Campaign/*`(CampaignCard, SnsTabBar 등), 비즈니스 규칙(isEnded, daysUntil 등) |
| `application` | `lib/api/applications.ts`, `components/Application/*`(StageBadge, ApplicationStepper, ApplicationCard, PostSubmitForm, InsightSubmitForm, ReceiptConfirmDialog), `lib/stage.ts` |
| `auth` | `lib/api/auth.ts`(부분), `context/InfluencerAuthContext.tsx`(stays as context), `context/SignupContext.tsx`(stays), `lib/zipcloud.ts`(별도 lib 유지) |
| `me` | `lib/api/me.ts`, profile/sns/bank/address 업데이트 mutation 훅 |
| `notice` | `lib/api/notices.ts` (있다면), 도메인 컴포넌트 (있다면) |

### admin-web
| 도메인 | 포함 자산 |
|---|---|
| `campaign` | `lib/api/campaigns.ts`(있는지 확인), `components/Campaign/*`, CampaignForm 등 |
| `application` | `lib/draftReviews.ts`, `components/Applicants/*`, `components/Drafts/*`, settlement 관련 |
| `influencer` | `lib/influencerApi.ts` (있다면), `components/Influencers/*` |
| `notice` | `components/Notices/*` |
| `broadcast` | `lib/broadcast.ts` (있다면), `components/Influencers/BroadcastDialog.tsx` |
| `overview` | `pages/Overview/index.tsx`의 데이터 fetch 부분 |
| `team` | `pages/Team/*` 의 api/hooks |
| `auth` | `lib/api/auth.ts`, `context/AuthContext.tsx`(stays) |

각 앱의 정확한 도메인 경계는 도메인별 PR 시작 시 grep으로 확정.

---

## 분할 전략

도메인 단위로 **별도 sub-PR**. 본 plan은 sub-PR 시퀀스를 정의한다:

- **PR 4.1** — `campaign` 도메인 (client-web + admin-web) — 파일럿. 본 plan에 상세 단계 포함.
- **PR 4.2** — `application` 도메인
- **PR 4.3** — `me` 도메인 (client-web)
- **PR 4.4** — `influencer` 도메인 (admin-web)
- **PR 4.5** — `notice` 도메인
- **PR 4.6** — `broadcast` + `overview` + `team` 도메인 (admin-web 잔여)
- **PR 4.7** — `auth` 정리 (가능한 범위)

각 sub-PR 단위로 별도 plan 파일 또는 본 plan에 sub-section을 추가하여 작업한다. 본 plan은 **PR 4.1 (campaign) 만 상세히 정의**한다. 나머지 sub-PR plan은 PR 4.1 머지 후 패턴이 검증되면 그 형식을 따라 작성한다.

---

## PR 4.1 — campaign 도메인 (파일럿)

### 현재 상태 (작업 시작 전 grep으로 확정)

```bash
# 사용처 확인
grep -rln "lib/api/campaigns\|components/Campaign" apps/admin-web/src apps/client-web/src
```

### client-web 캠페인 자산 이동

| 기존 | 새 위치 |
|---|---|
| `src/lib/api/campaigns.ts` | `src/domains/campaign/api.ts` |
| `src/components/Campaign/CampaignCard.tsx` | `src/domains/campaign/components/CampaignCard.tsx` |
| `src/components/Campaign/CampaignCard.css` | `src/domains/campaign/components/CampaignCard.css` |
| `src/components/Campaign/SnsTabBar.tsx` | `src/domains/campaign/components/SnsTabBar.tsx` |
| `src/components/Campaign/SnsTabBar.css` | `src/domains/campaign/components/SnsTabBar.css` |

신규 생성:
- `src/domains/campaign/hooks.ts` — `useCampaign(id)`, `useCampaignList(sns)` (페이지에서 useQuery 호출하던 것을 추출)
- `src/domains/campaign/utils.ts` — `formatYen`, `formatDateRange`, `daysUntil`, `isEnded`(이미 서버 응답에 있지만 폴백 계산) 등 페이지 인라인 헬퍼를 추출
- `src/domains/campaign/types.ts` — `@jsure/shared` 의 `InfluencerCampaignCard`, `InfluencerCampaignDetail` 재-export
- `src/domains/campaign/index.ts` — barrel

페이지 변경 (import 경로만):
- `pages/Browse/index.tsx`: `listCampaigns`, `CampaignCard`, `SnsTabBar` → `@/domains/campaign`
- `pages/CampaignDetail/index.tsx`: `getCampaign` → `@/domains/campaign`. 이왕 옮길 때 인라인 헬퍼(`formatYen`, `formatDate`, `daysUntil`, `closed` 계산)도 utils로 추출하여 page는 표시만 담당.
- `pages/Apply/index.tsx`: `getCampaign` → `@/domains/campaign`

### admin-web 캠페인 자산 이동

| 기존 | 새 위치 |
|---|---|
| (admin 측 캠페인 api 파일 grep으로 확정) | `apps/admin-web/src/domains/campaign/api.ts` |
| `components/Campaign/CampaignForm.tsx` | `domains/campaign/components/CampaignForm.tsx` |
| `components/Campaign/ExcludedCampaignsPicker.tsx` | `domains/campaign/components/ExcludedCampaignsPicker.tsx` |
| (관련 .css들) | 같은 폴더로 |

페이지 변경:
- `pages/Campaigns/{Index,Edit,Create}.tsx` 의 import 경로 + useQuery 호출이 있다면 domain hook으로 이전

### 단계별 절차 (PR 4.1)

1. 작업 브랜치 생성: `chore/frontend-pr4-1-campaign-domain`
2. client-web 캠페인 자산 이동/생성 (api, hooks, utils, types, components, index.ts)
3. client-web 페이지 import 갱신 + 인라인 비즈니스 로직 → utils로 이전
4. admin-web 캠페인 자산 동일 패턴
5. 빌드/lint/typecheck/시각 검증
6. commit per logical step
7. main 머지

각 단계는 별도 task로 분해해 subagent에 dispatch.

### 검증

- 빌드/lint/typecheck PASS
- 시각 회귀 0: Browse, CampaignDetail, Apply 화면 (client-web); Campaigns 목록/생성/수정 (admin-web)
- `grep -rln "lib/api/campaigns\|components/Campaign" apps/{admin,client}-web/src` 결과 0 (모두 도메인으로 이전됨)
- 새 import는 `@/domains/campaign` barrel만 사용

---

## PR 4.2 이후

PR 4.1 머지 후 패턴이 검증되면 PR 4.2~4.7을 동일 패턴으로 처리. 각 sub-PR은 다음 절차:

1. 도메인 자산 grep으로 확인
2. `src/domains/<domain>/` 구조 생성
3. api, hooks, utils, components 이동/추출
4. index.ts barrel 작성
5. 모든 importer 경로 갱신
6. 빌드/lint/typecheck/시각 검증
7. commit + main 머지

---

## 완료 정의 (PR 4 전체)

- [ ] 두 앱 모두 도메인 모듈 구조가 채워져 있다
- [ ] `lib/api/*` 가 비어 있다 (필요 시 도메인 무관 axios 인스턴스 정의 파일만 남김 — 예: `lib/api.ts` 의 axios instance)
- [ ] 페이지의 import는 도메인 모듈 barrel 또는 composites/ui 에서만 온다
- [ ] 페이지에 axios 직접 호출 0
- [ ] 페이지에 비즈니스 규칙(deriveDisplayStage, isEnded 같은 inline) 0
- [ ] 모든 화면 시각·동작 회귀 0
- [ ] ESLint 위반 0 (PR 1에서 등록한 도메인 내부 import 차단 룰 통과)
