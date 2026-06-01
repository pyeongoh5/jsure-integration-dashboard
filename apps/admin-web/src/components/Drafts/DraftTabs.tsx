import {
  DRAFT_TABS,
  type DraftReviewCounts,
  type DraftReviewTab,
} from "./types";

type Props = {
  value: DraftReviewTab;
  counts: DraftReviewCounts;
  onChange: (next: DraftReviewTab) => void;
};

export function DraftTabs({ value, counts, onChange }: Props) {
  return (
    <div className="dr__tabs">
      {DRAFT_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`dr-tab ${value === tab.key ? "dr-tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className="dr-tab__count">{counts[tab.key]}</span>
        </button>
      ))}
    </div>
  );
}
