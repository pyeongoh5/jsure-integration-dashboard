import type { SnsType } from "@jsure/shared";

const OPTIONS: readonly { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "TIKTOK", label: "틱톡" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "유튜브" },
];

type Props = {
  value: SnsType[];
  onChange: (next: SnsType[]) => void;
  disabled?: boolean;
};

export function SnsTypeChips({ value, onChange, disabled }: Props) {
  const toggle = (v: SnsType) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="cf__chips" role="group" aria-label="SNS 종류">
      {OPTIONS.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`cf__chip${selected ? " cf__chip--on" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
