import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LabeledInput } from "../../components/composites/LabeledInput";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";

function validate(email: string): { email?: string } {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { email: "正しいメールアドレスを入力してください" };
  }
  return {};
}

export function SignupAccount() {
  const nav = useNavigate();
  const { draft, setAccount } = useSignup();
  const [email, setEmail] = useState(draft.account.email);
  const [touched, setTouched] = useState(false);

  const errors = validate(email);
  const valid = Object.keys(errors).length === 0;

  function next() {
    setTouched(true);
    if (!valid) return;
    setAccount({ email, password: "" });
    nav("/signup/profile");
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        メールアドレス
      </h2>
      <p
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginTop: 0,
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        LINEでのご連絡が届かない場合に備えて、メールアドレスをご登録ください。
      </p>
      <LabeledInput
        label="メールアドレス"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={touched ? errors.email : undefined}
        placeholder="your@example.com"
      />
      <WizardFooter onBack={() => nav(-1)} onNext={next} />
    </div>
  );
}
