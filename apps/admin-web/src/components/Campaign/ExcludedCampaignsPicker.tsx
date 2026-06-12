import { useMemo, useState } from "react";
import type { CampaignResponse } from "@jsure/shared";
import "./ExcludedCampaignsPicker.css";

type Props = {
  allCampaigns: CampaignResponse[] | null;
  /** 편집 모드일 때 자기 자신은 선택지에서 제외 */
  selfId?: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function ExcludedCampaignsPicker({
  allCampaigns,
  selfId,
  value,
  onChange,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.filter((c) => c.id !== selfId);
  }, [allCampaigns, selfId]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.title.toLowerCase().includes(q));
  }, [candidates, query]);

  const selectedRows = useMemo(
    () => candidates.filter((c) => valueSet.has(c.id)),
    [candidates, valueSet],
  );

  const toggle = (id: string) => {
    if (valueSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  if (allCampaigns === null) {
    return <div className="excl__hint">캠페인 목록 불러오는 중…</div>;
  }
  if (candidates.length === 0) {
    return <div className="excl__hint">선택 가능한 기존 캠페인이 없습니다.</div>;
  }

  return (
    <div className="excl">
      <div className="excl__selected">
        {selectedRows.length === 0 ? (
          <div className="excl__empty">선택된 캠페인이 없습니다.</div>
        ) : (
          selectedRows.map((c) => (
            <span key={c.id} className="excl__chip">
              {c.title}
              <button
                type="button"
                className="excl__chip-remove"
                onClick={() => toggle(c.id)}
                disabled={disabled}
                aria-label="제거"
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      <input
        type="text"
        className="excl__search"
        placeholder="제목으로 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />

      <div className="excl__list">
        {filtered.length === 0 ? (
          <div className="excl__empty">검색 결과가 없습니다.</div>
        ) : (
          filtered.map((c) => {
            const checked = valueSet.has(c.id);
            return (
              <label
                key={c.id}
                className={`excl__row ${checked ? "is-checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.id)}
                  disabled={disabled}
                />
                <span className="excl__row-title">{c.title}</span>
                <span className="excl__row-meta">
                  {c.recruitStartDate} ~ {c.recruitEndDate}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
