import { STATUS_TABS, type ApplicantStatus, type StatusCounts } from "./types";

type Props = {
  value: ApplicantStatus;
  counts: StatusCounts;
  onChange: (next: ApplicantStatus) => void;
};

export function ApplicantTabs({ value, counts, onChange }: Props) {
  return (
    <div className="apl__tabs">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`apl-tab ${value === tab.key ? "apl-tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className="apl-tab__count">{counts[tab.key]}</span>
        </button>
      ))}
    </div>
  );
}
