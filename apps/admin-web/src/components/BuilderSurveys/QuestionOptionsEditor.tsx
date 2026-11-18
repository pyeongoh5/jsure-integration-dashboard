import { Button, IconButton, Input } from "@/components/ui";
import styles from "./QuestionOptionsEditor.module.css";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  maxCount?: number;
  addButtonLabel: string;
  itemPlaceholder: (index: number) => string;
  removeButtonAria: (index: number) => string;
};

const MIN_COUNT = 2;

/** 선택지/커스텀 라벨처럼 "2개 이상, 최대 N개" 짜리 문자열 목록 편집 — 순수 value/onChange. */
export function QuestionOptionsEditor({
  value,
  onChange,
  disabled = false,
  maxCount = 30,
  addButtonLabel,
  itemPlaceholder,
  removeButtonAria,
}: Props) {
  function setAt(index: number, next: string) {
    const nextValue = value.slice();
    nextValue[index] = next;
    onChange(nextValue);
  }

  function removeAt(index: number) {
    if (value.length <= MIN_COUNT) return;
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  function add() {
    if (value.length >= maxCount) return;
    onChange([...value, ""]);
  }

  return (
    <div className={styles.root}>
      {value.map((option, index) => (
        <div key={index} className={styles.row}>
          <Input
            value={option}
            onChange={(next) => setAt(index, next)}
            placeholder={itemPlaceholder(index)}
            disabled={disabled}
          />
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={removeButtonAria(index)}
            onClick={() => removeAt(index)}
            disabled={disabled || value.length <= MIN_COUNT}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        disabled={disabled || value.length >= maxCount}
      >
        {addButtonLabel}
      </Button>
    </div>
  );
}
