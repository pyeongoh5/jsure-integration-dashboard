import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listTemplates,
  setTemplateEnabled,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateListItem,
} from "@/domains/messageTemplate";
import { Switch } from "@/components/ui";
import { ScrollTable } from "@/components/composites";
import styles from "./MessageTemplates.module.css";

const CATEGORIES: { key: CampaignCategory; label: string }[] = [
  { key: "SNS", label: "SNS 캠페인" },
  { key: "FAKE_PURCHASE", label: "가구매 캠페인" },
  { key: "SIMPLE_REVIEW", label: "단순 리뷰 캠페인" },
];

const CATEGORY_KEYS = CATEGORIES.map((entry) => entry.key);

function parseCategory(raw: string | null): CampaignCategory {
  return CATEGORY_KEYS.includes(raw as CampaignCategory)
    ? (raw as CampaignCategory)
    : "SNS";
}

export function MessageTemplates(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = parseCategory(searchParams.get("category"));
  const [items, setItems] = useState<LineMessageTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const setCategory = (nextCategory: CampaignCategory): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("category", nextCategory);
        return next;
      },
      { replace: false },
    );
  };

  useEffect(() => {
    setLoading(true);
    listTemplates(category)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [category]);

  const handleToggle = async (
    item: LineMessageTemplateListItem,
    next: boolean,
  ): Promise<void> => {
    const key = item.triggerKey;
    setPendingKey(key);
    setItems((prev) =>
      prev.map((entry) => (entry.triggerKey === key ? { ...entry, enabled: next } : entry)),
    );
    try {
      const updated = await setTemplateEnabled(category, item.triggerKey, next);
      setItems((prev) =>
        prev.map((entry) =>
          entry.triggerKey === key
            ? {
                ...entry,
                enabled: updated.enabled,
                updatedAt: updated.updatedAt,
                updatedByName: updated.updatedByName,
              }
            : entry,
        ),
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.triggerKey === key ? { ...entry, enabled: !next } : entry,
        ),
      );
      const message = err instanceof Error ? err.message : "상태 변경 실패";
      alert(message);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>메시지 템플릿</div>
      </div>

      <div className={styles.filters}>
        <div className={styles.tabs}>
          {CATEGORIES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`${styles.tab} ${category === entry.key ? styles.tabActive : ""}`}
              onClick={() => setCategory(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.state}>불러오는 중…</div>
        ) : (
          <ScrollTable>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>트리거</th>
                  <th style={{ width: 100 }}>상태</th>
                  <th style={{ width: 180 }}>수정일</th>
                  <th style={{ width: 140 }}>수정자</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.triggerKey}
                    onClick={() =>
                      navigate(`/message-templates/${category}/${item.triggerKey}`)
                    }
                  >
                    <td>
                      <span className={styles.triggerCell}>{TRIGGER_LABELS[item.triggerKey]}</span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Switch
                        checked={item.enabled}
                        onChange={(next) => void handleToggle(item, next)}
                        disabled={pendingKey === item.triggerKey}
                        ariaLabel={`${TRIGGER_LABELS[item.triggerKey]} 활성화 토글`}
                      />
                    </td>
                    <td className={styles.mutedCell}>
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleString("ja-JP") : "-"}
                    </td>
                    <td className={styles.mutedCell}>{item.updatedByName ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </div>
    </div>
  );
}
