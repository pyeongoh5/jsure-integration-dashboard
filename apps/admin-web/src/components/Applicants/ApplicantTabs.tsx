import { STATUS_TABS, type ApplicantStatus, type StatusCounts } from "./types";

type Props = {
  value: ApplicantStatus;
  counts: StatusCounts;
  onChange: (next: ApplicantStatus) => void;
};

export function ApplicantTabs({ value, counts, onChange }: Props) {
  return (
    <div className="apl__tabs">
      {STATUS_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`apl-tab ${value === t.key ? "apl-tab--active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          <span className="apl-tab__count">{counts[t.key]}</span>
        </button>
      ))}
    </div>
  );
}
