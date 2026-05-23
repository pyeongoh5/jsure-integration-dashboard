import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LabeledInput } from "../../components/form/LabeledInput";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { useSignup } from "../../context/SignupContext";

function validate(
  email: string,
  password: string,
  confirm: string,
): { email?: string; password?: string; confirm?: string } {
  const errors: { email?: string; password?: string; confirm?: string } = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.email = "正しいメールアドレスを入力してください";
  }
  if (password.length < 8) {
    errors.password = "パスワードは8文字以上";
  }
  if (password !== confirm) {
    errors.confirm = "パスワードが一致しません";
  }
  return errors;
}

export function SignupAccount() {
  const nav = useNavigate();
  const { draft, setAccount } = useSignup();
  const [email, setEmail] = useState(draft.account.email);
  const [password, setPassword] = useState(draft.account.password);
  const [confirm, setConfirm] = useState(draft.account.password);
  const [touched, setTouched] = useState(false);

  const errors = validate(email, password, confirm);
  const valid = Object.keys(errors).length === 0;

  function next() {
    setTouched(true);
    if (!valid) return;
    setAccount({ email, password });
    nav("/signup/profile");
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        ログイン情報
      </h2>
      <LabeledInput
        label="メールアドレス"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={touched ? errors.email : undefined}
        placeholder="your@example.com"
      />
      <LabeledInput
        label="パスワード (8文字以上)"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        error={touched ? errors.password : undefined}
      />
      <LabeledInput
        label="パスワード確認"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={touched ? errors.confirm : undefined}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <PrimaryButton variant="ghost" onClick={() => nav(-1)}>
          戻る
        </PrimaryButton>
        <PrimaryButton onClick={next}>次へ</PrimaryButton>
      </div>
    </div>
  );
}
