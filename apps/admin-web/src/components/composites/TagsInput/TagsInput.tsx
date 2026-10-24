import { useId, useState, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n";
import styles from "./TagsInput.module.css";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  /** 입력란 아래 설명. 필요 없으면 생략. */
  hint?: string;
  /** 자동완성 후보. 비우면 추천 없이 자유 입력만 된다. */
  suggestions?: string[];
  disabled?: boolean;
};

const TAG_MAX_LENGTH = 20;
const TAGS_MAX_COUNT = 10;

/**
 * 어드민 전용 태그 칩 입력 — 엔터/스페이스/콤마로 태그를 확정하고 input 아래에 칩으로 쌓는다.
 * 캠페인 관리 태그와 인플루언서 관리 태그가 같은 입력을 쓴다.
 */
export function TagsInput({
  value,
  onChange,
  placeholder,
  hint,
  suggestions,
  disabled,
}: Props) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const suggestionListId = useId();

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

  // 이미 달린 태그는 후보에서 빼서 중복 선택을 유도하지 않는다.
  const availableSuggestions = (suggestions ?? []).filter(
    (suggestion) => !value.includes(suggestion),
  );

  return (
    <div className={styles.root}>
      <input
        type="text"
        className={styles.input}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        disabled={disabled}
        maxLength={TAG_MAX_LENGTH}
        list={availableSuggestions.length > 0 ? suggestionListId : undefined}
      />
      {availableSuggestions.length > 0 && (
        <datalist id={suggestionListId}>
          {availableSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
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
                aria-label={t("common.removeTag")}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
