import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listTemplates,
  setTemplateEnabled,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateListItem,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import { Radio, Switch } from "@/components/ui";
import { ScrollTable } from "@/components/composites";
import styles from "./MessageTemplates.module.css";

const CATEGORIES: { key: CampaignCategory; label: string }[] = [
  { key: "SNS", label: "SNS 캠페인" },
  { key: "FAKE_PURCHASE", label: "가구매 캠페인" },
];

const SNS_SUB_TYPES = ["INSTAGRAM", "X"] as const satisfies readonly LineTriggerSubType[];
const FAKE_PURCHASE_SUB_TYPES = ["QOO10", "LIPS", "ATCOSME"] as const satisfies readonly LineTriggerSubType[];

const SUB_TYPE_LABEL: Record<LineTriggerSubType, string> = {
  INSTAGRAM: "Instagram",
  X: "X",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

function subTypesFor(category: CampaignCategory): readonly LineTriggerSubType[] {
  return category === "FAKE_PURCHASE" ? FAKE_PURCHASE_SUB_TYPES : SNS_SUB_TYPES;
}

export function MessageTemplates(): JSX.Element {
  const navigate = useNavigate();
  const [category, setCategory] = useState<CampaignCategory>("SNS");
  const [subType, setSubType] = useState<LineTriggerSubType>("INSTAGRAM");

  const handleCategoryChange = (next: CampaignCategory): void => {
    setCategory(next);
    setSubType(next === "FAKE_PURCHASE" ? "QOO10" : "INSTAGRAM");
  };
  const [items, setItems] = useState<LineMessageTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listTemplates(category, subType)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [category, subType]);

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
      const updated = await setTemplateEnabled(category, subType, item.triggerKey, next);
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
              onClick={() => handleCategoryChange(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className={styles.subTypeRow}>
          <span>{category === "FAKE_PURCHASE" ? "플랫폼" : "SNS 유형"}</span>
          <div className={styles.subTypeGroup}>
            {subTypesFor(category).map((option) => (
              <Radio
                key={option}
                name="subType"
                checked={subType === option}
                onChange={() => setSubType(option)}
                label={SUB_TYPE_LABEL[option]}
              />
            ))}
          </div>
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
                {items.map((it) => (
                  <tr
                    key={it.triggerKey}
                    onClick={() =>
                      navigate(`/message-templates/${category}/${subType}/${it.triggerKey}`)
                    }
                  >
                    <td>
                      <span className={styles.triggerCell}>{TRIGGER_LABELS[it.triggerKey]}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={it.enabled}
                        onChange={(next) => void handleToggle(it, next)}
                        disabled={pendingKey === it.triggerKey}
                        ariaLabel={`${TRIGGER_LABELS[it.triggerKey]} 활성화 토글`}
                      />
                    </td>
                    <td className={styles.mutedCell}>
                      {it.updatedAt ? new Date(it.updatedAt).toLocaleString("ja-JP") : "-"}
                    </td>
                    <td className={styles.mutedCell}>{it.updatedByName ?? "-"}</td>
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
