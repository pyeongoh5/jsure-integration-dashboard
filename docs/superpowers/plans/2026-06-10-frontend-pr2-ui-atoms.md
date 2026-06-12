# PR 2 — Frontend UI Atoms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/admin-web/src/components/ui/`, `apps/client-web/src/components/ui/`에 도메인 무관 atom 컴포넌트 10종을 구현한다. 기존 사용처는 손대지 않고, 후속 PR에서 도입한다.

**Architecture:** 각 atom은 `Component.tsx` + `Component.module.css` 한 쌍. 스타일은 PR 1에서 정의한 토큰 변수만 사용. 두 앱은 별도 구현(독립 디자인 시스템 결정)이지만 prop 인터페이스는 동일하게 유지해 후속 PR에서 사용처 마이그레이션이 쉬워지도록 한다.

**Tech Stack:** React 18 + TypeScript, CSS Modules.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md) 섹션 3.1, 10번 PR 2.

**불변 조건 (스펙 0번):** 기존 코드는 변경하지 않는다. 신규 atom 컴포넌트는 어떤 페이지에서도 import되지 않아야 한다(PR 3+ 에서 도입).

---

## 대상 Atom 목록 (10종)

각 app마다 동일 목록을 구현. prop 인터페이스는 양쪽 동일하나 스타일은 각자.

1. **Button** — `variant: "primary" | "secondary" | "danger" | "ghost"`, `size: "sm" | "md" | "lg"`, `loading`, `disabled`, `type`, `children`, `onClick`
2. **IconButton** — Button과 동일 props에 `aria-label` 필수. 정사각형 + icon child
3. **Input** — `type: "text" | "email" | "tel" | "password" | "number"`, `value`, `onChange(v: string)`, `placeholder`, `inputMode`, `autoComplete`, `maxLength`, `disabled`, `error?: boolean`(error 스타일링용 boolean), `name`, `id`
4. **Textarea** — Input과 유사한 인터페이스, `rows`, `value`, `onChange(v: string)`, `error?: boolean`
5. **Select** — `value`, `onChange(v: string)`, `options: { value: string; label: string }[]` 또는 `children`(native option), `placeholder`, `disabled`, `error?: boolean`
6. **Checkbox** — `checked`, `onChange(v: boolean)`, `label?: ReactNode`, `disabled`
7. **Radio** — `checked`, `onChange()`, `label?: ReactNode`, `name`, `value`, `disabled`
8. **Badge** — `tone: "neutral" | "ok" | "warn" | "danger" | "primary"`, `size: "sm" | "md"`, `children`
9. **Spinner** — `size: "sm" | "md" | "lg"`, `aria-label?` (기본값 "Loading")
10. **Dialog** — `open`, `onClose()`, `title?`, `children`, `footer?: ReactNode`. native `<dialog>` 또는 portal 기반.

각 atom은 도메인 모름. prop 타입에 도메인 모델 없음. 단일 책임.

---

## File Structure

각 앱당 20개 신규 파일 (atom 10개 × 2 = tsx + module.css). 총 40개.

```
apps/{admin,client}-web/src/components/ui/
  Button.tsx
  Button.module.css
  IconButton.tsx
  IconButton.module.css
  Input.tsx
  Input.module.css
  Textarea.tsx
  Textarea.module.css
  Select.tsx
  Select.module.css
  Checkbox.tsx
  Checkbox.module.css
  Radio.tsx
  Radio.module.css
  Badge.tsx
  Badge.module.css
  Spinner.tsx
  Spinner.module.css
  Dialog.tsx
  Dialog.module.css
  index.ts        # barrel
```

`index.ts`는 모든 atom을 named export.

기존 코드 일체 수정 없음. 새 atom은 어떤 페이지/컴포넌트에서도 import되지 않는다.

---

## 검증 전략

각 atom 구현 후:
1. `pnpm --filter @jsure/{app} build` PASS
2. `pnpm --filter @jsure/{app} typecheck` PASS
3. `pnpm --filter @jsure/{app} lint` PASS

PR 1에서 `src/components/ui/**` 에 `../../` 금지 룰이 켜져 있다. atom 구현 시 이 룰 위반 없도록.

기능 시각 검증은 후속 PR에서 사용처 도입 시 수행. PR 2에선 컴파일 + lint만 확인.

---

## Tasks

각 task는 동일한 패턴:
- atom 1개의 tsx + module.css 작성
- (마지막 atom 작업 후) index.ts barrel 갱신 — 또는 매 atom 작성 시 누적 export
- 빌드/lint/타입체크 통과
- commit

PR 2는 큰 PR이라 각 task는 atom 1개를 두 앱 모두에 구현하는 단위로 분할한다(10 task).

### 공통 가이드라인 (모든 task에 적용)

- 색·간격·반경·폰트 사이즈는 `src/styles/tokens.css`의 CSS 변수만 사용. 하드코딩 금지.
- CSS Modules 클래스명은 BEM 없이 단순 명사(`.button`, `.primary`, `.lg` 등). `composes:`로 variant 결합 가능.
- TypeScript: `interface Props { ... }` + `export function ComponentName(props: Props)`.
- prop 기본값은 함수 시그니처에서 처리(`size: Size = "md"`).
- `forwardRef`는 필요 시만 사용 (Input/Textarea/Select는 forwardRef 사용해 RHF가 ref 받게).
- 이벤트 prop: native HTMLElement 인터페이스에 가깝게(`onClick`, `onChange` 등).
- `disabled` 상태 시 `pointer-events: none` + opacity 0.6 적용 + `aria-disabled`.
- 접근성: 적절한 ARIA 속성. Dialog는 focus trap 없이 단순 native `<dialog>` 사용.
- 두 앱의 같은 atom은 **prop 인터페이스 동일**. 스타일만 다름.
- 두 앱의 시각 톤:
  - admin-web: 데스크탑 데이터 밀도 — `--space-2 ~ --space-4`, `--radius-md`, `--font-size-sm ~ --font-size-md`
  - client-web: 모바일 우선 — 터치 타겟 44px 이상, `--space-3 ~ --space-5`, `--radius-md ~ --radius-lg`, `--font-size-md ~ --font-size-lg`

각 task 끝에 다음 commit 메시지 패턴을 사용:
```
feat({admin-web|client-web}): UI atom <Name> 추가
```

두 앱 모두 작업한 task는 단일 commit으로:
```
feat(ui): atom <Name> 추가 (admin-web + client-web)
```

본 plan은 후자(단일 commit per atom)를 채택한다.

---

## Task 1: Button atom

**Files:**
- Create: `apps/admin-web/src/components/ui/Button.tsx`
- Create: `apps/admin-web/src/components/ui/Button.module.css`
- Create: `apps/client-web/src/components/ui/Button.tsx`
- Create: `apps/client-web/src/components/ui/Button.module.css`

### 인터페이스

```ts
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  // 구현
}
```

### admin-web Button.module.css 가이드

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.button:disabled,
.button[aria-disabled="true"] {
  opacity: 0.6;
  cursor: not-allowed;
}
.sm { padding: var(--space-1) var(--space-2); font-size: var(--font-size-sm); }
.md { padding: var(--space-2) var(--space-3); font-size: var(--font-size-md); }
.lg { padding: var(--space-3) var(--space-4); font-size: var(--font-size-base); }

.primary {
  background: var(--color-primary);
  color: #fff;
}
.primary:hover:not(:disabled) { background: var(--color-primary-hover); }

.secondary {
  background: var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-border);
}
.secondary:hover:not(:disabled) { background: var(--color-bg-subtle); }

.danger {
  background: var(--color-danger);
  color: #fff;
}

.ghost {
  background: transparent;
  color: var(--color-text);
}
.ghost:hover:not(:disabled) { background: var(--color-bg-muted); }

.loading {
  cursor: progress;
}
```

### client-web Button.module.css 가이드

admin-web과 동일 색 매핑. 차이점:
- `min-height: 44px;` 추가 (md 이상)
- `padding`을 한 단계 크게: sm은 var(--space-2) var(--space-3), md는 var(--space-3) var(--space-4), lg는 var(--space-4) var(--space-5)
- font-size 한 단계 크게: sm: md, md: base, lg: lg

### tsx 구현 (양쪽 동일)

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    loading ? styles.loading : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}
```

### Step 1: admin-web Button 작성

위 인터페이스/CSS 가이드대로 `apps/admin-web/src/components/ui/Button.tsx` + `Button.module.css` 작성.

### Step 2: client-web Button 작성

client-web 가이드대로 모바일 친화 사이즈로 작성. tsx는 admin-web과 동일.

### Step 3: 빌드/lint/typecheck

```bash
pnpm --filter @jsure/admin-web build
pnpm --filter @jsure/client-web build
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/client-web lint
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/client-web typecheck
```

모두 PASS. atom이 어디서도 import되지 않아 dead code 경고가 날 수 있는데 ESLint 기본 설정에선 그렇지 않다. 빌드 산출물엔 tree-shaking으로 빠진다.

### Step 4: commit

```bash
git add apps/admin-web/src/components/ui/Button.tsx apps/admin-web/src/components/ui/Button.module.css \
        apps/client-web/src/components/ui/Button.tsx apps/client-web/src/components/ui/Button.module.css
git commit -m "feat(ui): atom Button 추가 (admin-web + client-web)"
```

---

## Task 2: IconButton atom

Button과 동일한 패턴이나 다음 차이:
- 정사각형 (width = height)
- icon child 1개만 받는다는 가정
- `aria-label` 필수 (interface에 `aria-label: string`)
- size: sm=28px, md=36px, lg=44px

### 인터페이스

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  "aria-label": string;
  children: ReactNode;
}

export function IconButton({
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  const classes = [styles.iconButton, styles[variant], styles[size], className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} disabled={disabled || loading} aria-disabled={disabled || loading} className={classes} {...rest}>
      {children}
    </button>
  );
}
```

### CSS (admin-web)
```css
.iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  color: var(--color-text);
  transition: background 0.15s;
}
.sm { width: 28px; height: 28px; font-size: 14px; }
.md { width: 36px; height: 36px; font-size: 16px; }
.lg { width: 44px; height: 44px; font-size: 20px; }
.primary { color: var(--color-primary); }
.primary:hover:not(:disabled) { background: var(--color-bg-muted); }
.secondary { color: var(--color-text); }
.secondary:hover:not(:disabled) { background: var(--color-bg-muted); }
.danger { color: var(--color-danger); }
.danger:hover:not(:disabled) { background: var(--color-danger-bg); }
.ghost { color: var(--color-text-muted); }
.ghost:hover:not(:disabled) { background: var(--color-bg-muted); }
.iconButton:disabled, .iconButton[aria-disabled="true"] { opacity: 0.6; cursor: not-allowed; }
```

### CSS (client-web)
admin-web과 동일하되 sm=36px, md=44px, lg=52px (터치 타겟 확대).

### Steps
1. admin-web 작성
2. client-web 작성
3. 빌드/lint/typecheck
4. commit: `feat(ui): atom IconButton 추가 (admin-web + client-web)`

---

## Task 3: Input atom

### 인터페이스

```tsx
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { value, onChange, error = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={[styles.input, error ? styles.error : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});
```

`forwardRef`로 RHF가 register 시 ref 받게 한다.

### CSS (admin-web)
```css
.input {
  width: 100%;
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: inherit;
}
.input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
  border-color: var(--color-primary);
}
.input:disabled {
  opacity: 0.6;
  background: var(--color-bg-subtle);
  cursor: not-allowed;
}
.error {
  border-color: var(--color-danger);
}
.error:focus {
  outline-color: var(--color-danger);
}
```

### CSS (client-web)
admin과 동일하되 `height: 44px;`, `font-size: var(--font-size-base);`, `padding: 0 var(--space-4);`

### Steps
1. admin-web Input 작성
2. client-web Input 작성
3. 검증
4. commit: `feat(ui): atom Input 추가 (admin-web + client-web)`

---

## Task 4: Textarea atom

Input과 동일 패턴, `<textarea>`로 변경. `rows` prop 추가 (기본 4).

```tsx
import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { value, onChange, error = false, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={rows}
      className={[styles.textarea, error ? styles.error : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});
```

CSS는 Input과 거의 동일하나 `height` 대신 `min-height` + `resize: vertical`.

### Steps
1. admin-web Textarea
2. client-web Textarea
3. 검증
4. commit: `feat(ui): atom Textarea 추가 (admin-web + client-web)`

---

## Task 5: Select atom

### 인터페이스

```tsx
import { forwardRef } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import styles from "./Select.module.css";

interface Option {
  value: string;
  label: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "children"> {
  value?: string;
  onChange?: (value: string) => void;
  options?: Option[];
  placeholder?: string;
  error?: boolean;
  children?: ReactNode; // options 대신 native option 직접 넘기는 경우
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { value, onChange, options, placeholder, error = false, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={[styles.select, error ? styles.error : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
});
```

CSS는 Input과 유사 + 네이티브 select 화살표. `appearance: none` + 배경 svg or `appearance: auto` 그대로 둠. 단순화를 위해 native 화살표 유지.

### Steps
1. admin-web Select
2. client-web Select
3. 검증
4. commit: `feat(ui): atom Select 추가 (admin-web + client-web)`

---

## Task 6: Checkbox atom

### 인터페이스

```tsx
import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Checkbox.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { checked, onChange, label, className, disabled, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
      className={styles.input}
      {...rest}
    />
  );
  if (!label) return <span className={[styles.wrap, className ?? ""].filter(Boolean).join(" ")}>{input}</span>;
  return (
    <label className={[styles.wrap, styles.withLabel, className ?? ""].filter(Boolean).join(" ")}>
      {input}
      <span className={styles.label}>{label}</span>
    </label>
  );
});
```

### CSS
네이티브 checkbox 활용. wrap은 flex로 input + label 정렬. client-web은 터치 타겟용 padding 추가.

### Steps → commit `feat(ui): atom Checkbox 추가 (admin-web + client-web)`

---

## Task 7: Radio atom

Checkbox와 동일 패턴이나 `type="radio"`, `name` prop 필수.

```tsx
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onChange?: () => void;
  label?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, Props>(function Radio(
  { checked, onChange, label, className, disabled, ...rest },
  ref,
) {
  // 비슷한 구조. onChange: () => void (선택됐다는 신호만)
});
```

CSS 동일 패턴.

### Steps → commit `feat(ui): atom Radio 추가 (admin-web + client-web)`

---

## Task 8: Badge atom

### 인터페이스
```tsx
import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Tone = "neutral" | "ok" | "warn" | "danger" | "primary";
type Size = "sm" | "md";

interface Props {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", size = "sm", children, className }: Props) {
  const classes = [styles.badge, styles[tone], styles[size], className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{children}</span>;
}
```

### CSS
```css
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}
.sm { padding: 2px var(--space-2); font-size: var(--font-size-xs); }
.md { padding: var(--space-1) var(--space-3); font-size: var(--font-size-sm); }
.neutral { background: var(--color-bg-muted); color: var(--color-text-muted); }
.ok { background: var(--color-ok-bg); color: var(--color-ok-text); }
.warn { background: var(--color-warn-bg); color: var(--color-warn-text); }
.danger { background: var(--color-danger-bg); color: var(--color-danger-text); }
.primary { background: #dbeafe; color: var(--color-primary); }
```

### Steps → commit `feat(ui): atom Badge 추가 (admin-web + client-web)`

---

## Task 9: Spinner atom

### 인터페이스
```tsx
import styles from "./Spinner.module.css";

type Size = "sm" | "md" | "lg";

interface Props {
  size?: Size;
  "aria-label"?: string;
  className?: string;
}

export function Spinner({ size = "md", className, "aria-label": ariaLabel = "Loading" }: Props) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={[styles.spinner, styles[size], className ?? ""].filter(Boolean).join(" ")}
    />
  );
}
```

### CSS
```css
.spinner {
  display: inline-block;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}
.sm { width: 14px; height: 14px; }
.md { width: 20px; height: 20px; }
.lg { width: 28px; height: 28px; }
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Steps → commit `feat(ui): atom Spinner 추가 (admin-web + client-web)`

---

## Task 10: Dialog atom

native `<dialog>` 기반 단순 구현. 포털 + focus trap 제외(YAGNI).

### 인터페이스
```tsx
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./Dialog.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, className ?? ""].filter(Boolean).join(" ")}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {title && <header className={styles.header}>{title}</header>}
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}
```

### CSS (admin-web)
```css
.dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  background: var(--color-bg);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  max-width: 90vw;
  width: 480px;
}
.dialog::backdrop {
  background: rgba(17, 24, 39, 0.4);
}
.header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
}
.body {
  padding: var(--space-4);
}
.footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
```

### CSS (client-web)
모바일 — `width: 92vw; max-width: 480px;`, `padding`을 한 단계 크게.

### Steps → commit `feat(ui): atom Dialog 추가 (admin-web + client-web)`

---

## Task 11: index.ts barrel + 최종 검증

**Files:**
- Create: `apps/admin-web/src/components/ui/index.ts`
- Create: `apps/client-web/src/components/ui/index.ts`

### index.ts (양쪽 동일)

```ts
export { Button } from "./Button";
export { IconButton } from "./IconButton";
export { Input } from "./Input";
export { Textarea } from "./Textarea";
export { Select } from "./Select";
export { Checkbox } from "./Checkbox";
export { Radio } from "./Radio";
export { Badge } from "./Badge";
export { Spinner } from "./Spinner";
export { Dialog } from "./Dialog";
```

### 최종 검증

```bash
pnpm --filter @jsure/admin-web build
pnpm --filter @jsure/client-web build
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/client-web lint
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/client-web typecheck
```

모두 PASS.

### 화면 회귀 확인

새 atom은 어디서도 import되지 않으므로 시각 회귀 0. 그래도 admin/client 주요 화면을 한 번씩 열어 확인:
- admin-web: Overview, Campaigns, Payouts
- client-web: Browse, CampaignDetail, Applications

### commit

```bash
git add apps/admin-web/src/components/ui/index.ts apps/client-web/src/components/ui/index.ts
git commit -m "feat(ui): atom barrel index.ts 추가"
```

---

## 완료 정의

- [ ] 각 앱의 `src/components/ui/` 에 10개 atom + index.ts 존재 (총 21개 파일 × 2 = 42개)
- [ ] 모든 atom이 토큰 변수만 사용 (`grep -rE "#[0-9a-fA-F]" apps/{admin,client}-web/src/components/ui/` 결과 0)
- [ ] `pnpm --filter @jsure/admin-web build && pnpm --filter @jsure/client-web build` 모두 PASS
- [ ] `pnpm --filter @jsure/admin-web lint && pnpm --filter @jsure/client-web lint` 모두 PASS
- [ ] `pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/client-web typecheck` 모두 PASS
- [ ] 기존 페이지/컴포넌트 import 변화 없음 (즉 새 atom이 도입되지 않음 — PR 3+에서 도입)
- [ ] 화면 외관·동작 회귀 없음
