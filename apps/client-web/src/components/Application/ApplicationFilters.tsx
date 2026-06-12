import type { SnsType } from "@jsure/shared";
import type { StatusFilter } from "./applicationFilter";
import "./ApplicationFilters.css";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "applied", label: "申請" },
  { value: "rejected", label: "却下" },
  { value: "in_progress", label: "進行中" },
  { value: "ended", label: "終了" },
];

const SNS_CHIPS: { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];

type Props = {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  selectedSnsTypes: Set<SnsType>;
  onToggleSns: (snsType: SnsType) => void;
};

export function ApplicationFilters({
  statusFilter,
  onStatusChange,
  selectedSnsTypes,
  onToggleSns,
}: Props) {
  return (
    <div className="apps-filters">
      <div className="apps-filters__row">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`apps-filters__tab ${
              statusFilter === tab.value ? "is-active" : ""
            }`}
            onClick={() => onStatusChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="apps-filters__row">
        {SNS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`apps-filters__chip ${
              selectedSnsTypes.has(chip.value) ? "is-active" : ""
            }`}
            onClick={() => onToggleSns(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
