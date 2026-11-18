import { useEffect, useRef } from "react";
import type { BuilderSurveyListItem } from "@jsure/shared";
import { ActionMenu, ScrollTable } from "@/components/composites";
import { Radio } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./SurveyTable.module.css";

type Props = {
  surveys: BuilderSurveyListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRequestDelete: (survey: BuilderSurveyListItem) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 앙케이트 목록 표 — fetch·route 는 모르고 props 로 받은 데이터와 콜백만 그린다. */
export function SurveyTable({
  surveys,
  selectedId,
  onSelect,
  onEdit,
  onRequestDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const t = useT();

  // IntersectionObserver 가 매 렌더마다 재등록되지 않도록 안정적인 참조로 넘긴다.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, surveys.length]);

  if (surveys.length === 0) {
    return <div className={styles.empty}>{t("pages.builderSurveys.empty")}</div>;
  }

  return (
    <ScrollTable>
      <table className={styles.root}>
        <thead>
          <tr>
            <th className={styles.selectCell}>
              {t("pages.builderSurveys.table.select")}
            </th>
            <th>{t("pages.builderSurveys.table.title")}</th>
            <th style={{ width: 120 }}>{t("pages.builderSurveys.table.createdAt")}</th>
            <th style={{ width: 120 }}>{t("pages.builderSurveys.table.updatedAt")}</th>
            <th style={{ width: 140 }}>{t("pages.builderSurveys.table.createdBy")}</th>
            <th style={{ width: 140 }}>{t("pages.builderSurveys.table.updatedBy")}</th>
            <th
              className={styles.actionsCell}
              aria-label={t("pages.builderSurveys.table.actionsAria")}
            />
          </tr>
        </thead>
        <tbody>
          {surveys.map((survey) => (
            <tr key={survey.id}>
              <td className={styles.selectCell}>
                <Radio
                  checked={selectedId === survey.id}
                  onChange={() => onSelect(survey.id)}
                  aria-label={t("pages.builderSurveys.table.select")}
                />
              </td>
              <td>{survey.title}</td>
              <td className={styles.date}>{formatDate(survey.createdAt)}</td>
              <td className={styles.date}>{formatDate(survey.updatedAt)}</td>
              <td>{survey.createdByName}</td>
              <td>{survey.updatedByName}</td>
              <td>
                <ActionMenu
                  ariaLabel={t("pages.builderSurveys.table.actionsAria")}
                  items={[
                    {
                      key: "edit",
                      label: t("pages.builderSurveys.actions.edit"),
                      onSelect: () => onEdit(survey.id),
                    },
                    {
                      key: "delete",
                      label: t("pages.builderSurveys.actions.delete"),
                      danger: true,
                      onSelect: () => onRequestDelete(survey),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={sentinelRef} className={styles.sentinel}>
        {loadingMore ? t("pages.builderSurveys.loadingMore") : null}
      </div>
    </ScrollTable>
  );
}
