# PR 5 — Forms Migration to react-hook-form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 모든 폼을 react-hook-form + zodResolver로 통일. 페이지/컴포넌트의 필드별 `useState` 제거. **검증 메시지·검증 시점·제출 동작이 기존과 동일**해야 한다.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md) 섹션 6, 10번 PR 5.

---

## 절대 원칙

- 외관·동작 동일. 검증 트리거 시점(현재는 submit 시 `touched=true` 후 errors 표시) 보존
- Zod schema는 `@jsure/shared`에서 그대로 가져옴
- 페이지에서 `useState`로 폼 필드 관리 절대 금지 (이번 PR 결과물)
- 에러 메시지는 기존 schema가 정의한 message를 그대로 사용

---

## 의존성 설치

```bash
pnpm --filter @jsure/admin-web add react-hook-form @hookform/resolvers
pnpm --filter @jsure/client-web add react-hook-form @hookform/resolvers
```

---

## 단계 1 — FormField composite 추가 (양 앱)

`src/components/composites/FormField.tsx`:

```tsx
import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type FieldPath } from "react-hook-form";
import styles from "./FormField.module.css";

interface Props<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  label?: ReactNode;
  hint?: ReactNode;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    error: boolean;
  }) => ReactNode;
}

export function FormField<TFieldValues extends FieldValues>({
  name,
  label,
  hint,
  children,
}: Props<TFieldValues>) {
  const {
    formState: { errors, isSubmitted, touchedFields },
  } = useFormContext<TFieldValues>();
  const error = errors[name as string];
  const showError = (isSubmitted || touchedFields[name as string]) && !!error;
  const id = `ff-${String(name).replace(/\./g, "-")}`;

  return (
    <label htmlFor={id} className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      {children({ id, "aria-invalid": showError, error: showError })}
      {showError && (
        <span className={styles.error}>
          {(error?.message as string | undefined) ?? "入力内容を確認してください"}
        </span>
      )}
      {!showError && hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
```

CSS:
```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}
.label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
.error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
}
.hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
```

barrel 추가: `composites/index.ts` (없다면 신규 생성) 에 `export { FormField } from "./FormField";`

---

## 단계 2 — 폼 페이지별 마이그레이션

각 폼은 다음 패턴으로 변환:

### Before (예: Signup/Account.tsx)
```tsx
const [email, setEmail] = useState("");
const [touched, setTouched] = useState(false);
const errors = {
  email: /.../.test(email) ? undefined : "邮箱を入力",
};
function next() {
  setTouched(true);
  if (Object.values(errors).some(Boolean)) return;
  setAccount({ email });
  nav("/signup/profile");
}
// JSX: <LabeledInput value={email} onChange={setEmail} error={touched ? errors.email : undefined} />
```

### After
```tsx
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が不正です"),
});
type FormValues = z.infer<typeof schema>;

const methods = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { email: draft.account.email },
});

function next(values: FormValues) {
  setAccount(values);
  nav("/signup/profile");
}

return (
  <FormProvider {...methods}>
    <form onSubmit={methods.handleSubmit(next)}>
      <FormField<FormValues> name="email" label="メールアドレス">
        {(field) => (
          <Input
            type="email"
            {...methods.register("email")}
            error={field.error}
            placeholder="your@example.com"
          />
        )}
      </FormField>
      <WizardFooter onBack={...} onNext={methods.handleSubmit(next)} />
    </form>
  </FormProvider>
);
```

**중요:**
- shared 패키지에 이미 정의된 schema가 있으면 그것을 그대로 사용 (예: `InfluencerSignupRequestSchema`의 `email` 필드)
- 단일 step만 부분 검증할 경우 `schema.pick({ email: true })` 사용
- 에러 메시지는 schema의 message 그대로 → 현재와 동일

### 마이그레이션 대상 폼

#### client-web (10개)
1. `pages/Signup/Account.tsx` — email
2. `pages/Signup/Profile.tsx` — name/nameKana/phone/birthDate + address (zipcloud 자동완성 보존)
3. `pages/Signup/Terms.tsx` — checkbox 그룹 (consent items 6개)
4. `pages/Signup/Sns.tsx` — sns accounts 동적 array
5. `pages/Signup/Bank.tsx` — bank/branchName/branchCode/accountNumber/accountHolderKana
6. `pages/Me/Profile.tsx` — 동일 필드들
7. `pages/Me/Sns.tsx`
8. `pages/Me/Bank.tsx`
9. `pages/Me/Address.tsx`
10. `pages/Apply/index.tsx` — SNS 선택 + 확인
11. `domains/application/components/PostSubmitForm.tsx` — url 입력
12. `domains/application/components/InsightSubmitForm.tsx` — 7+ 숫자 필드 + 첨부

#### admin-web (4+)
1. `domains/campaign/components/CampaignForm.tsx` — 가장 복잡. snsRecruits 동적, RichTextEditor, ExcludedCampaignsPicker
2. `domains/notice/components/NoticeEditor.tsx`
3. `domains/broadcast/components/BroadcastDialog.tsx`
4. `pages/Team/index.tsx` 의 초대 폼 (있다면)
5. 로그인 폼 (있다면)

---

## 작업 순서

1. PR 5.0: 의존성 설치 + FormField composite (양 앱) — 단일 commit
2. PR 5.1: client-web Signup 흐름 (5개 폼) — 단계별 검증
3. PR 5.2: client-web Me 페이지 (4개 폼)
4. PR 5.3: client-web Apply + PostSubmit + InsightSubmit
5. PR 5.4: admin-web CampaignForm (가장 위험. 단독 PR 권장)
6. PR 5.5: admin-web 잔여 폼 (NoticeEditor, BroadcastDialog, Team 등)

각 sub-PR은 머지 전 해당 폼을 실제 화면에서 워크스루:
- 빈 폼 제출 → 동일한 에러 메시지 동일한 위치에 표시되는가
- 유효 폼 제출 → 정상 동작
- 에러 후 수정 → 에러 표시가 사라지는 시점이 동일한가
- 라인 가입 플로우의 비밀번호 optional 처리 같은 분기 로직 보존

---

## 검증 체크리스트 (각 sub-PR)

- [ ] 빌드/lint/typecheck PASS
- [ ] 화면 외관 회귀 0
- [ ] 검증 메시지 텍스트 동일
- [ ] 검증 트리거 시점 동일 (이전: submit 시 touched=true → 모든 필드 에러 표시. RHF: handleSubmit 호출 시 동일 동작 가능 — `mode: "onSubmit"` 기본값)
- [ ] 페이지에 `useState`로 필드 관리 0건 (grep 검증)

---

## 완료 정의

- [ ] 모든 폼이 RHF + zodResolver 사용
- [ ] FormField composite 채택
- [ ] 페이지/컴포넌트에 폼 필드 관리용 `useState` 0건
- [ ] 모든 외관·동작 회귀 0
