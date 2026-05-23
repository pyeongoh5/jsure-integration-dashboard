import { useState } from "react";
import type { SnsType } from "@jsure/shared";
import { LabeledInput } from "../form/LabeledInput";
import { PrimaryButton } from "../form/PrimaryButton";

interface Props {
  snsType: SnsType;
  initial: string;
  onSubmit: (url: string) => Promise<void>;
  submitting: boolean;
}

const URL_RE = /^https?:\/\/.+/i;

export function PostSubmitForm({
  snsType,
  initial,
  onSubmit,
  submitting,
}: Props) {
  const [url, setUrl] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = URL_RE.test(url) ? undefined : "正しいURLを入力してください";

  async function handle() {
    setTouched(true);
    if (error) return;
    await onSubmit(url);
  }

  return (
    <div>
      <LabeledInput
        label={`${snsType} 投稿URL`}
        type="text"
        value={url}
        onChange={setUrl}
        error={touched ? error : undefined}
        placeholder="https://instagram.com/p/..."
      />
      <PrimaryButton onClick={handle} disabled={submitting}>
        {submitting ? "送信中…" : initial ? "投稿URLを更新" : "投稿URLを提出"}
      </PrimaryButton>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10, textAlign: "center" }}>
        ⚠ 投稿冒頭に #PR を必ず記載
      </p>
    </div>
  );
}
