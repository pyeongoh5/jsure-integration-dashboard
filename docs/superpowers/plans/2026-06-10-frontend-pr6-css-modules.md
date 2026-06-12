# PR 6 — CSS Modules + 최종 정리

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 모든 `.css` 를 `.module.css` 로 전환. 클래스명을 BEM에서 단순 명사로 변경. 하드코딩된 색·간격·폰트 사이즈를 토큰으로 치환. 미사용 코드 삭제. ESLint 룰 본격 적용.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md) 섹션 5, 10번 PR 6.

---

## 절대 원칙

- 외관·동작 동일 (스타일 시각 결과 동일)
- 토큰으로 치환하는 값은 기존 값과 동일한 결과를 내야 한다 (e.g. `#1d6cf3` → `var(--color-primary)` 인데 토큰 정의 자체가 `#1d6cf3`라면 OK)
- 토큰에 없는 값을 발견하면 먼저 토큰을 추가하고 사용

---

## 작업 흐름 (한 파일당)

각 컴포넌트 단위로 다음 절차:

1. `Component.css` → `Component.module.css` rename (`git mv`)
2. CSS 안 클래스명을 BEM 단순화: `.ccard__title` → `.title`, `.cdetail__msg--err` → `.errMsg` (CSS Modules가 스코프 보장)
3. CSS 안 하드코딩 값을 토큰 변수로 치환:
   - 색: `#1d6cf3` → `var(--color-primary)`, `#6b7280` → `var(--color-text-muted)` 등
   - 간격: `8px` → `var(--space-2)`, `16px` → `var(--space-4)` 등
   - 반경: `8px`(border-radius) → `var(--radius-md)` 등
   - 폰트 사이즈: `13px` → `var(--font-size-md)` 등
   - 그림자: 토큰 `--shadow-sm/md` 활용
4. tsx 에서 import 변경: `import "./Component.css"` → `import styles from "./Component.module.css"`
5. tsx 의 className 을 styles 객체 참조로:
   ```tsx
   className="ccard__title"  →  className={styles.title}
   className="ccard__title ccard__title--lg"  →  className={[styles.title, styles.titleLg].join(" ")}
   ```
6. 시각 회귀 확인 (DevTools에서 클래스명 다르지만 computed style 동일해야 함)
7. commit

---

## 대상 .css 파일

전체 grep:
```bash
find apps/admin-web/src apps/client-web/src -name "*.css" -not -name "*.module.css"
```

예상 파일 수: 30+. 각 파일 마이그레이션 = 1 commit.

### 정적/전역 .css 는 그대로 유지

- `apps/{admin,client}-web/src/styles/tokens.css` — `:root` 변수, 모듈화 불필요
- `apps/{admin,client}-web/src/index.css` — 전역 reset/font, 모듈화 불필요
- `apps/{admin,client}-web/src/App.css` 등 (있다면) — 전역
- vendor css (fontawesome 등) — 그대로

### 마이그레이션 대상 = 컴포넌트와 1:1로 묶인 .css

각 ui atom, composite, domain component, page에 해당하는 .css 파일들.

---

## 토큰 치환 매핑 (참고)

기존 코드에서 자주 등장한 값들을 토큰으로:

| 기존 값 | 토큰 |
|---|---|
| `#1d6cf3`, `#2563eb` | `--color-primary`, `--color-primary-hover` |
| `#111`, `#111827`, `#1f2937` | `--color-text` |
| `#374151`, `#4b5563` | `--color-text` 또는 `--color-text-muted` |
| `#6b7280` | `--color-text-muted` |
| `#9ca3af` | `--color-text-subtle` |
| `#e5e7eb`, `#eee` | `--color-border` |
| `#d1d5db` | `--color-border-strong` |
| `#fff`, `#ffffff` | `--color-bg` |
| `#f9fafb` | `--color-bg-subtle` |
| `#f3f4f6` | `--color-bg-muted` |
| `#ef4444`, `#dc2626` | `--color-danger` |
| `#fee2e2`, `#fecaca` | `--color-danger-bg` |
| `#991b1b`, `#b91c1c` | `--color-danger-text` |
| `#10b981`, `#059669` | `--color-ok` |
| `#d1fae5`, `#ecfdf5` | `--color-ok-bg` |
| `#065f46`, `#166534` | `--color-ok-text` |
| `#f59e0b`, `#fbbf24` | `--color-warn` |
| `#fef3c7`, `#fde68a` | `--color-warn-bg` |
| `#92400e`, `#b45309` | `--color-warn-text` |
| `4px` | `--space-1` |
| `8px` | `--space-2` |
| `12px` | `--space-3` |
| `16px` | `--space-4` |
| `20px` | `--space-5` |
| `24px` | `--space-6` |
| `32px` | `--space-8` |
| `40px` | `--space-10` |
| `4px` (border-radius) | `--radius-sm` |
| `8px` (border-radius) | `--radius-md` |
| `12px` (border-radius) | `--radius-lg` |
| `999px` (border-radius) | `--radius-full` |

토큰에 없는 색·크기를 발견하면 token.css 에 추가 후 사용. 새 추가가 많아지면 디자인 일관성 측면에서 표준화 회의가 필요할 수 있지만 본 PR 에서는 일단 token에 추가.

---

## 작업 분할 전략

전체를 한 PR 로 처리하기엔 너무 크다. 다음으로 분할:

1. **PR 6.1**: ui atoms — atom 컴포넌트는 이미 모듈로 작성됨 (PR 2). 이 단계 스킵 가능.
2. **PR 6.2**: composites
3. **PR 6.3**: client-web domains/* + pages/*
4. **PR 6.4**: admin-web domains/* + pages/*
5. **PR 6.5**: 잔여 정리 — 미사용 코드 삭제, ESLint 룰 위반 0 확인

각 sub-PR은 도메인 또는 폴더 단위로 commit 분리 (시각 확인이 어려운 거대 PR 방지).

---

## 검증 (각 sub-PR)

- [ ] 빌드/lint/typecheck PASS
- [ ] 시각 회귀 0 — 영향받는 모든 화면 워크스루
- [ ] `grep -rE "#[0-9a-fA-F]" apps/{admin,client}-web/src/components apps/{admin,client}-web/src/domains apps/{admin,client}-web/src/pages` 결과가 토큰에 등록된 값 외에는 없어야 (또는 거의 0)

---

## 완료 정의

- [ ] 모든 컴포넌트 .css가 .module.css 로 전환됨
- [ ] tsx의 className 이 `styles.xxx` 객체 참조
- [ ] 하드코딩 색·간격·폰트 사이즈 grep 결과 0 (또는 tokens.css 자체만)
- [ ] 외관 회귀 0
- [ ] PR 1에서 추가한 ESLint 룰 위반 0
