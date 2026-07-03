# client-web i18n 구현 계획

**스펙:** `docs/superpowers/specs/2026-07-02-client-web-i18n-design.md`
**워크트리:** `.claude/worktrees/feat+client-web-i18n` (브랜치 `worktree-feat+client-web-i18n`)

## Context

`apps/client-web`은 일본인 사용자용 UI지만 개발자(한국인)가 하드코딩된 일본어 ~400개를 코드 안에서 관리하기 어렵다. 빌드타임 locale 고정 방식(`VITE_I18N_REGION`)의 i18n을 도입해서 개발은 한국어 기준으로, 프로덕션 빌드는 일본어로 하는 흐름을 만든다. QA는 GitHub 웹 에디터로 `messages.ts` 하나만 편집한다.

## 결정 사항

- **테스트 러너 미도입** — client-web에 현재 vitest/jest 없음. i18n만을 위해 도입은 오버킬. 검증은 `typecheck` + `validate-i18n.mjs` + `pnpm dev` 구동 확인으로 대체.
- **한국어 초안 번역은 마이그레이션 태스크 중 원문 일본어를 근거로 함께 작성.** QA가 이후 최종 검수.

## 파일 구조

> **참고:** 이 계획 실행 후 QA 편집 접근성 개선을 위해 `i18n/`을 저장소 최상위로 이동했다. 최종 구조는 스펙 문서를 참고. 계획 원문은 히스토리 보존 차원에서 그대로 둔다.

```
apps/client-web/
  src/i18n/
    messages.ts          # 소스 오브 트루스: { [group]: { [leaf]: { kr, jp } } }
    t.ts                 # t(key) 함수 + DotPath / TranslationKey 타입
    index.ts             # t 재export
  src/vite-env.d.ts      # ImportMetaEnv에 VITE_I18N_REGION 추가
  scripts/
    validate-i18n.ts     # 빌드 전 검증 (누락 leaf → exit 1). tsx로 실행
  .env.development       # VITE_I18N_REGION=kr
  package.json           # build 스크립트에 검증 스텝 삽입
```

## 태스크 분해

각 태스크는 독립적으로 typecheck + dev 서버 구동 확인 후 커밋한다. 커밋 메시지는 한글.

### T1. i18n 인프라 세팅
- 신규 파일 4개 작성 (`src/i18n/messages.ts`, `t.ts`, `index.ts`; `scripts/validate-i18n.ts`)
- `messages.ts`는 빈 골격 `export const messages = {} as const;`
- `t.ts`:
  - `type Region = 'kr' | 'jp'`
  - `type DotPath<T>` 재귀 타입: leaf(`{kr:string; jp:string}`) 감지, 경로 문자열 union 리턴
  - `type TranslationKey = DotPath<typeof messages>`
  - `const region = (import.meta.env.VITE_I18N_REGION as Region) ?? 'kr'`
  - `export function t(key: TranslationKey): string` — dot-path split → messages 탐색 → `[region]` 반환
- `scripts/validate-i18n.ts`: `messages.ts`를 `import { messages }`로 가져와서 재귀 탐색. 각 leaf가 `{ kr, jp }` 두 필드를 갖고, 두 값 모두 non-empty string인지 검사. 누락 시 경로 리스트 출력 후 `process.exit(1)`.
- `apps/client-web/package.json`에 `"tsx": "^4"` devDependency 추가 (validate 스크립트 실행용)
- `.env.development` 신규: `VITE_I18N_REGION=kr`
- `.env.example` 갱신: `VITE_I18N_REGION` 문서화
- `src/vite-env.d.ts`의 `ImportMetaEnv`에 `readonly VITE_I18N_REGION?: 'kr' | 'jp'` 추가
- `apps/client-web/package.json`의 `build` 스크립트:
  `"build": "tsx scripts/validate-i18n.ts && tsc -b && vite build"`
- **검증:** 빈 `messages.ts` 상태에서 `pnpm --filter @jsure/client-web build`가 성공(누락 leaf 없으니 통과). `VITE_I18N_REGION=kr pnpm dev:client` 구동 확인.
- **커밋:** `feat(client-web): i18n 인프라 세팅 (messages/t/validate)`

### T2. 마이그레이션 — components/ + domains/auth + domains/notice + domains/campaign (총 ~16문자열)
- 대상 파일:
  - `src/components/composites/BottomTabBar.tsx` (3)
  - `src/components/composites/WizardFooter/WizardFooter.tsx` (2)
  - `src/components/composites/FormField.tsx` (1)
  - `src/components/composites/PageHeader.tsx` (1)
  - `src/domains/auth/components/TermsAccordion.tsx` (1)
  - `src/domains/auth/components/SnsAccountCard.tsx` (1)
  - `src/domains/campaign/components/CampaignCard.tsx` (6)
- 각 파일: 하드코딩 일본어 → `messages.ts`에 등록(`jp` 원문, `kr` 초안 번역), 사용측은 `t('...')`로 치환
- `messages.ts` 구조 예:
  ```ts
  export const messages = {
    common: { /* 공용 버튼/라벨 등 */ },
    components: { bottomTab: {...}, wizardFooter: {...}, formField: {...}, pageHeader: {...} },
    auth: { terms: {...}, snsAccount: {...} },
    campaign: { card: {...} },
  } as const;
  ```
- **검증:** `pnpm --filter @jsure/client-web typecheck`, dev 서버 구동 후 해당 UI 접근 확인.
- **커밋:** `feat(client-web): components/auth/campaign 도메인 i18n 마이그레이션`

### T3. 마이그레이션 — domains/me + domains/application (총 ~66문자열)
- 대상 파일:
  - `src/domains/me/components/AddressFormFields.tsx` (15) — zod errorMap도 함께
  - `src/domains/me/components/BankSelect.tsx` (4)
  - `src/domains/application/components/*.tsx` (컴포넌트 여러 개, 총 ~43)
  - `src/domains/application/utils.ts` (4) — pure 모듈에서 `t()` 직접 호출 OK (t는 pure)
- **주의**: `AddressFormFields.tsx`의 zod 스키마 안 에러 메시지는 스키마 정의 시점에 `t()` 호출로 인라인 가능. errorMap도 동일.
- `messages.ts`에 `me.address`, `me.bank`, `application.*` 그룹 추가
- **검증:** typecheck + 해당 페이지 (Apply/Applications/Me 관련) dev 서버에서 열어보기
- **커밋:** `feat(client-web): me/application 도메인 i18n 마이그레이션`

### T4. 마이그레이션 — pages/Apply + pages/Signup (총 ~64문자열)
- 대상:
  - `src/pages/Apply/index.tsx` (31)
  - `src/pages/Signup/Bank.tsx` (12), `Profile.tsx` (9), `Sns.tsx` (5), `Account.tsx` (4), `Terms.tsx` (2), `LineSignup.tsx` (1)
- `messages.ts`에 `pages.apply.*`, `pages.signup.*` 추가
- **검증:** 신규 회원가입 플로우 + 캠페인 지원 플로우 dev에서 클릭 확인
- **커밋:** `feat(client-web): Apply/Signup 페이지 i18n 마이그레이션`

### T5. 마이그레이션 — pages/Applications + pages/CampaignDetail + pages/Me (총 ~58문자열)
- 대상:
  - `src/pages/Applications/Detail.tsx` (17), `index.tsx` (5)
  - `src/pages/CampaignDetail/index.tsx` (11)
  - `src/pages/Me/*.tsx` (Bank/Profile/Sns/index/Address 총 25)
- **검증:** 각 페이지 dev에서 확인
- **커밋:** `feat(client-web): Applications/CampaignDetail/Me 페이지 i18n 마이그레이션`

### T6. 마이그레이션 — pages/Auth + pages/Browse + pages/Notices (총 ~8문자열)
- 대상:
  - `src/pages/Auth/LineReturn.tsx` (3), `Login.tsx` (2)
  - `src/pages/Browse/index.tsx` (2)
  - `src/pages/Notices/index.tsx` (1)
- **검증:** 각 페이지 확인
- **커밋:** `feat(client-web): Auth/Browse/Notices 페이지 i18n 마이그레이션`

### T7. 최종 검증 + 잔여 정리
- `grep -rE "[ぁ-んァ-ヶー]" src --exclude-dir=i18n` 실행 → 결과 0이어야 함
  - 문자열 리터럴이 아닌 부분(주석 등)은 예외로 두고 표기
- `VITE_I18N_REGION=jp pnpm --filter @jsure/client-web build` — 성공해야 함 (모든 leaf에 jp 채워져 있으므로)
- `VITE_I18N_REGION=jp pnpm --filter @jsure/client-web dev`로 일본어 렌더링 스팟 체크
- `VITE_I18N_REGION=kr pnpm --filter @jsure/client-web dev`로 한국어 렌더링 스팟 체크
- Railway 환경변수 문서 갱신 필요 시 README 짧게 추가 (별도 파일 생성 금지)
- **커밋:** `chore(client-web): i18n 마이그레이션 최종 검증`

## 재사용/주의 사항

- **CODE_RULES 준수:**
  - `§3` env는 zod로 파싱 — `t.ts`에서 `import.meta.env.VITE_I18N_REGION`을 `z.enum(['kr','jp']).catch('kr')`로 파싱해서 `region` 상수 초기화.
  - `§0` 무관 리팩토링 금지 — 이번 PR은 문자열 추출만. 로직/구조 변경 금지.
  - `§4` 새 폴더(`src/i18n/`, `apps/client-web/scripts/`) 생성은 이미 스펙에서 승인됨.
- **`domains/application/utils.ts`**: 순수 유틸에서 `t()` 호출 문제 없음 (`t()`는 React hook 아님, 순수 함수).
- **zod errorMap 안의 문자열**: `AddressFormFields.tsx`, `z.string().regex(POSTAL_RE, "郵便番号は7桁")` 같은 스키마 정의는 모듈 로드 시점에 평가되므로 `t()` 호출도 그 시점에 확정된다 (빌드타임 region이라 문제 없음).
- **스펙 문서 커밋**은 이미 완료 (`64c9460`).
- **문서 신규 생성 금지** (`CODE_RULES §0`) — 계획 승인 후 최종 계획을 `docs/superpowers/plans/2026-07-02-client-web-i18n.md`에 저장(스펙과 페어). Railway 환경변수 관련 별도 README 신설은 하지 않고, 필요 시 기존 README에 문단 추가.

## Verification (전체 완료 후)

```bash
cd .claude/worktrees/feat+client-web-i18n

# 1. 하드코딩 일본어 잔여 없음
grep -rEn "[ぁ-んァ-ヶー]" apps/client-web/src \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=i18n
# 결과: 매치 없음

# 2. 타입 검사
pnpm --filter @jsure/client-web typecheck

# 3. 일본어 빌드 (검증 스크립트 + 빌드)
VITE_I18N_REGION=jp pnpm --filter @jsure/client-web build

# 4. 누락 시나리오 테스트 (일부 jp를 빈 문자열로 만들어보고 빌드 실패 확인 후 롤백)

# 5. 두 언어 dev 확인
VITE_I18N_REGION=kr pnpm --filter @jsure/client-web dev  # → 한국어 렌더링
VITE_I18N_REGION=jp pnpm --filter @jsure/client-web dev  # → 일본어 렌더링
```

## Out of Scope

- admin-web, api의 i18n
- 런타임 언어 스위처
- plural / 문자열 보간 API
- ESLint 규칙으로 하드코딩 일본어 금지 (후속 작업)
- Railway 환경변수 실제 배포 반영 (사용자가 대시보드에서 직접 설정)
