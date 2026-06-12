import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SnsType } from "@jsure/shared";
import {
  ApplicationCard,
  ApplicationFilters,
  filterApplications,
  useApplications,
  type StatusFilter,
} from "@/domains/application";
import "./Applications.css";

export function Applications() {
  const nav = useNavigate();
  const { data, isLoading, isError } = useApplications();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedSnsTypes, setSelectedSnsTypes] = useState<Set<SnsType>>(
    new Set(),
  );

  const toggleSns = (snsType: SnsType) => {
    setSelectedSnsTypes((prev) => {
      const next = new Set(prev);
      if (next.has(snsType)) next.delete(snsType);
      else next.add(snsType);
      return next;
    });
  };

  const applications = data ?? [];
  const filtered = filterApplications(
    applications,
    statusFilter,
    selectedSnsTypes,
  );

  return (
    <div className="apps">
      <header className="apps__header">
        <h1>応募内訳</h1>
      </header>

      {!isLoading && !isError && applications.length > 0 && (
        <ApplicationFilters
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          selectedSnsTypes={selectedSnsTypes}
          onToggleSns={toggleSns}
          onClearSns={() => setSelectedSnsTypes(new Set())}
        />
      )}

      <div className="apps__list">
        {isLoading && <div className="apps__empty">読み込み中…</div>}
        {isError && (
          <div className="apps__empty">読み込みに失敗しました</div>
        )}
        {!isLoading && !isError && applications.length === 0 && (
          <div className="apps__empty">
            まだ応募していません
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="apps__cta"
                onClick={() => nav("/")}
              >
                キャンペーンを探す
              </button>
            </div>
          </div>
        )}
        {!isLoading &&
          !isError &&
          applications.length > 0 &&
          filtered.length === 0 && (
            <div className="apps__empty">該当する応募がありません</div>
          )}
        {filtered.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            onSelect={() => nav(`/applications/${app.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
