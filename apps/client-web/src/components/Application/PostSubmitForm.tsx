import { useState } from "react";
import type { SnsType } from "@jsure/shared";
import { LabeledInput } from "../composites/LabeledInput";
import { PrimaryButton } from "../composites/PrimaryButton";

interface Props {
  snsType: SnsType;
  initial: string;
  onSubmit: (url: string) => Promise<void>;
  submitting: boolean;
}

const URL_RE = /^https?:\/\/.+/i;

const PLACEHOLDER_BY_SNS: Record<SnsType, string> = {
  INSTAGRAM: "https://www.instagram.com/p/...",
  TIKTOK: "https://www.tiktok.com/@user/video/...",
  X: "https://x.com/user/status/...",
  YOUTUBE: "https://www.youtube.com/watch?v=...",
};

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
        placeholder={PLACEHOLDER_BY_SNS[snsType]}
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
