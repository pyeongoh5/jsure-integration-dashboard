import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
/** 추천 목록은 스크롤 없이 한눈에 보이는 만큼만 띄운다. */
const SUGGESTION_LIMIT = 8;

/**
 * 어드민 전용 태그 칩 입력 — 칩을 입력란 안에 쌓고, 등록된 태그를 직접 그린
 * 드롭다운으로 추천한다. 캠페인 관리 태그와 인플루언서 관리 태그가 함께 쓴다.
 *
 * 네이티브 `<datalist>` 를 쓰지 않는 이유: 브라우저·OS 기본 스타일이 그대로
 * 나와서 어드민 톤과 맞지 않고, 활성 항목 표시나 키보드 이동도 손댈 수 없다.
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
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const full = value.length >= TAGS_MAX_COUNT;

  // 이미 달린 태그는 후보에서 빼고, 입력 중이면 부분일치로 좁힌다.
  const matches = useMemo(() => {
    const query = draft.trim().toLowerCase();
    return (suggestions ?? [])
      .filter((suggestion) => !value.includes(suggestion))
      .filter(
        (suggestion) =>
          query === "" || suggestion.toLowerCase().includes(query),
      )
      .slice(0, SUGGESTION_LIMIT);
  }, [suggestions, value, draft]);

  const suggestionsOpen = open && !disabled && !full && matches.length > 0;
  const activeSuggestion = suggestionsOpen ? matches[activeIndex] : undefined;

  function commitTag(tag: string) {
    const trimmed = tag.trim().slice(0, TAG_MAX_LENGTH);
    setDraft("");
    setActiveIndex(0);
    if (!trimmed || value.includes(trimmed) || full) return;
    onChange([...value, trimmed]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((current) => current !== tag));
  }

  function moveActive(step: number) {
    setActiveIndex((current) => {
      const next = current + step;
      if (next < 0) return matches.length - 1;
      if (next >= matches.length) return 0;
      return next;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글·일본어 IME 조합 중 엔터는 조합 확정이므로 태그 확정으로 취급하지 않는다.
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === ",") {
      event.preventDefault();
      // 드롭다운에서 고른 항목이 있으면 그것을, 없으면 입력한 글자를 단다.
      commitTag(
        event.key === "Enter" && activeSuggestion ? activeSuggestion : draft,
      );
      return;
    }
    // 빈 입력에서 백스페이스는 마지막 칩을 지운다 — 태그 입력의 관용 동작.
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={styles.root}>
      {/* 추천 목록이 필드 바로 아래에 붙도록 둘을 같은 기준 상자에 담는다. */}
      <div className={styles.fieldWrap}>
        <div
          className={`${styles.field} ${disabled ? styles.fieldDisabled : ""}`}
          onClick={() => inputRef.current?.focus()}
          role="presentation"
        >
          {value.map((tag) => (
            <span key={tag} className={styles.chip}>
              {tag}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={(event) => {
                  event.stopPropagation();
                  removeTag(tag);
                }}
                disabled={disabled}
                aria-label={t("common.removeTag")}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={draft}
            placeholder={value.length === 0 ? placeholder : ""}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              commitTag(draft);
            }}
            disabled={disabled || full}
            maxLength={TAG_MAX_LENGTH}
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-controls={listboxId}
            aria-activedescendant={
              activeSuggestion ? `${listboxId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
          />
        </div>

        {suggestionsOpen && (
          <ul className={styles.suggestions} id={listboxId} role="listbox">
            {matches.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`${styles.suggestion} ${
                  index === activeIndex ? styles.suggestionActive : ""
                }`}
                // mousedown 을 막아야 input 의 blur 가 먼저 떠 목록이 닫히지 않는다.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitTag(suggestion)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
