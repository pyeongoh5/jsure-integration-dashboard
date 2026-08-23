import { useState, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n";
import styles from "./CampaignTagsInput.module.css";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const TAG_MAX_LENGTH = 20;
const TAGS_MAX_COUNT = 10;

/** 어드민 전용 태그 칩 입력 — 엔터/스페이스/콤마로 태그를 확정하고 input 아래에 칩으로 쌓는다. */
export function CampaignTagsInput({ value, onChange, disabled }: Props) {
  const t = useT();
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const tag = draft.trim().slice(0, TAG_MAX_LENGTH);
    setDraft("");
    if (!tag || value.includes(tag) || value.length >= TAGS_MAX_COUNT) return;
    onChange([...value, tag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((current) => current !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글·일본어 IME 조합 중 엔터는 조합 확정이므로 태그 확정으로 취급하지 않는다.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === " " || event.key === ",") {
      event.preventDefault();
      commitDraft();
    }
  }

  return (
    <div className={styles.root}>
      <input
        type="text"
        className={styles.input}
        value={draft}
        placeholder={t("domains.campaign.form.tagsPlaceholder")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        disabled={disabled}
        maxLength={TAG_MAX_LENGTH}
      />
      {value.length > 0 && (
        <div className={styles.chips}>
          {value.map((tag) => (
            <span key={tag} className={styles.chip}>
              {tag}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={t("domains.campaign.form.tagsRemoveAria")}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <p className={styles.hint}>{t("domains.campaign.form.tagsHint")}</p>
    </div>
  );
}
