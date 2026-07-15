import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CampaignCategory } from "@jsure/shared";
import {
  ApplicationCard,
  ApplicationFilters,
  filterApplications,
  useApplications,
  type StatusFilter,
} from "@/domains/application";
import { t } from "@i18n";
import styles from "./Applications.module.css";

export function Applications() {
  const nav = useNavigate();
  const { data, isLoading, isError } = useApplications();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<
    Set<CampaignCategory>
  >(new Set());

  const toggleCategory = (category: CampaignCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const applications = data ?? [];
  const filtered = filterApplications(applications, statusFilter, selectedCategories);

  return (
    <div>
      <header className={styles.header}>
        <h1>{t("pages.applications.list.title")}</h1>
      </header>

      {!isLoading && !isError && applications.length > 0 && (
        <ApplicationFilters
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          onClearCategories={() => setSelectedCategories(new Set())}
        />
      )}

      <div className={styles.list}>
        {isLoading && (
          <div className={styles.empty}>{t("pages.applications.list.loading")}</div>
        )}
        {isError && (
          <div className={styles.empty}>{t("pages.applications.list.loadError")}</div>
        )}
        {!isLoading && !isError && applications.length === 0 && (
          <div className={styles.empty}>
            {t("pages.applications.list.empty")}
            <div style={{ marginTop: 12 }}>
              <button type="button" className={styles.cta} onClick={() => nav("/")}>
                {t("pages.applications.list.findCampaign")}
              </button>
            </div>
          </div>
        )}
        {!isLoading && !isError && applications.length > 0 && filtered.length === 0 && (
          <div className={styles.empty}>{t("pages.applications.list.filteredEmpty")}</div>
        )}
        {filtered.map((app) => (
          <ApplicationCard key={app.id} app={app} onSelect={() => nav(`/applications/${app.id}`)} />
        ))}
      </div>
    </div>
  );
}
