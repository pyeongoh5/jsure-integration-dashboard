# PR 3 — Frontend Composites Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 기존 `components/form/`, `components/layout/` 및 admin-web `components/Breadcrumb.*` 의 재사용 컴포넌트를 `components/composites/`로 이동하고 모든 import 경로를 갱신한다. **외관·동작 변경 없음. 파일 위치와 import 경로만 바뀐다.**

**Architecture:** `git mv` 또는 read+write+delete로 파일을 새 위치로 옮긴 뒤, 모든 importer를 일괄 갱신. CSS 파일명은 `.css` 그대로 유지(`.module.css` 전환은 PR 6에서). 컴포넌트 내부 코드와 CSS 내용은 손대지 않음.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md) 섹션 3.2, 10번 PR 3.

**불변 조건:** 외관·동작 불변. import 경로만 변경.

---

## 대상 파일

### client-web
| 기존 위치 | 새 위치 |
|---|---|
| `src/components/form/LabeledInput.tsx` | `src/components/composites/LabeledInput.tsx` |
| `src/components/form/LabeledInput.css` | `src/components/composites/LabeledInput.css` |
| `src/components/form/RadioGroup.tsx` | `src/components/composites/RadioGroup.tsx` |
| `src/components/form/RadioGroup.css` | `src/components/composites/RadioGroup.css` |
| `src/components/form/ErrorBanner.tsx` | `src/components/composites/ErrorBanner.tsx` |
| `src/components/form/ErrorBanner.css` | `src/components/composites/ErrorBanner.css` |
| `src/components/form/PrimaryButton.tsx` | `src/components/composites/PrimaryButton.tsx` |
| `src/components/form/PrimaryButton.css` | `src/components/composites/PrimaryButton.css` |
| `src/components/layout/PageHeader.tsx` | `src/components/composites/PageHeader.tsx` |
| `src/components/layout/PageHeader.css` | `src/components/composites/PageHeader.css` |
| `src/components/layout/BottomTabBar.tsx` | `src/components/composites/BottomTabBar.tsx` |
| `src/components/layout/BottomTabBar.css` | `src/components/composites/BottomTabBar.css` |

`components/layout/RequireAuth.tsx`는 그대로 둠 (auth guard wrapper, 라우팅 셸).

### admin-web
| 기존 위치 | 새 위치 |
|---|---|
| `src/components/Breadcrumb.tsx` | `src/components/composites/Breadcrumb.tsx` |
| `src/components/Breadcrumb.css` | `src/components/composites/Breadcrumb.css` |

---

## 갱신해야 할 importer

### client-web (12개 파일)
- `src/layouts/AppShell.tsx` — `../components/layout/BottomTabBar` → `../components/composites/BottomTabBar`
- `src/components/Address/AddressFormFields.tsx` — `../form/LabeledInput` → `../composites/LabeledInput`
- `src/components/Application/ReceiptConfirmDialog.tsx` — `../form/PrimaryButton` → `../composites/PrimaryButton`
- `src/components/Application/InsightSubmitForm.tsx` — form/LabeledInput, form/PrimaryButton 두 줄
- `src/components/Application/PostSubmitForm.tsx` — form/LabeledInput, form/PrimaryButton 두 줄
- `src/pages/Apply/index.tsx` — layout/PageHeader, form/PrimaryButton, form/ErrorBanner
- `src/pages/Signup/Account.tsx` — form/LabeledInput
- `src/pages/Signup/Profile.tsx` — form/LabeledInput
- `src/pages/Signup/Bank.tsx` — form/LabeledInput, form/ErrorBanner
- `src/pages/CampaignDetail/index.tsx` — layout/PageHeader, form/PrimaryButton
- `src/pages/Me/Address.tsx` — layout/PageHeader, form/PrimaryButton, form/ErrorBanner
- `src/pages/Me/Profile.tsx` — layout/PageHeader, form/LabeledInput, form/PrimaryButton
- `src/pages/Me/Bank.tsx` — layout/PageHeader, form/LabeledInput, form/PrimaryButton, form/ErrorBanner
- `src/pages/Me/Sns.tsx` — layout/PageHeader, form/PrimaryButton, form/ErrorBanner
- `src/pages/Applications/Detail.tsx` — layout/PageHeader, form/PrimaryButton

각 import 라인의 경로 부분만 `form/` → `composites/`, `layout/PageHeader` → `composites/PageHeader`, `layout/BottomTabBar` → `composites/BottomTabBar`로 치환. 다른 어떤 코드 변경도 없음.

### admin-web (1개 파일)
- `src/components/Header/index.tsx` — `@/components/Breadcrumb` → `@/components/composites/Breadcrumb`

---

## Tasks

### Task 1 — client-web 파일 이동 + import 갱신

**Steps:**
1. `git mv` 12개 파일 (form/* → composites/*, layout/PageHeader.* → composites/, layout/BottomTabBar.* → composites/)
2. 위에 나열된 12개 importer 파일의 import 라인 경로를 새 위치로 갱신. **다른 라인은 절대 건드리지 마라.**
3. 빌드/lint/typecheck 검증

```bash
pnpm --filter @jsure/client-web build
pnpm --filter @jsure/client-web lint
pnpm --filter @jsure/client-web typecheck
```
모두 PASS 확인.

4. 시각 회귀 확인 (수동): `pnpm dev:client` 으로 Browse/CampaignDetail/Apply/Applications/Me/Signup 페이지 시각 확인.

5. commit:
```bash
git add -A
git commit -m "refactor(client-web): form/* 와 layout/* 일부 컴포넌트를 composites/ 로 이동"
```

### Task 2 — admin-web 파일 이동 + import 갱신

**Steps:**
1. `git mv apps/admin-web/src/components/Breadcrumb.tsx apps/admin-web/src/components/composites/Breadcrumb.tsx`
2. `git mv apps/admin-web/src/components/Breadcrumb.css apps/admin-web/src/components/composites/Breadcrumb.css`
3. `apps/admin-web/src/components/Header/index.tsx` 의 import를 `@/components/composites/Breadcrumb`로 갱신
4. 빌드/lint/typecheck 검증
5. commit:
```bash
git add -A
git commit -m "refactor(admin-web): Breadcrumb 를 composites/ 로 이동"
```

### Task 3 — 최종 통합 검증
```bash
pnpm --filter @jsure/admin-web build && pnpm --filter @jsure/client-web build
pnpm --filter @jsure/admin-web lint && pnpm --filter @jsure/client-web lint
pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/client-web typecheck
```
모두 PASS.

`apps/client-web/src/components/form/` 폴더가 비어 있다면 삭제. (admin/client에 빈 폴더 남기지 않음)

---

## 완료 정의

- [ ] 모든 대상 파일이 `components/composites/`에 존재
- [ ] 기존 `components/form/` 비어 있고 삭제됨
- [ ] `components/layout/`에 `RequireAuth.tsx`만 남음 (PageHeader, BottomTabBar는 이동됨)
- [ ] 모든 importer 갱신 — `grep -rn "components/form\|components/layout/PageHeader\|components/layout/BottomTabBar" apps/client-web/src` 결과 0
- [ ] `grep -rn "@/components/Breadcrumb[^/]" apps/admin-web/src` 결과 0 (composites/ 외에는 참조 없음)
- [ ] 빌드/lint/typecheck 모두 PASS
- [ ] 화면 시각·동작 회귀 없음
