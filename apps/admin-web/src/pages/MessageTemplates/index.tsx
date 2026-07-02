import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listTemplates,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateListItem,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import styles from "./MessageTemplates.module.css";

const CATEGORIES: { key: CampaignCategory; label: string; disabled?: boolean }[] = [
  { key: "SNS", label: "SNS 캠페인" },
  { key: "FAKE_PURCHASE", label: "가구매 (준비중)", disabled: true },
];

const SUB_TYPES: LineTriggerSubType[] = ["INSTAGRAM", "X"];

export function MessageTemplates(): JSX.Element {
  const [category, setCategory] = useState<CampaignCategory>("SNS");
  const [subType, setSubType] = useState<LineTriggerSubType>("INSTAGRAM");
  const [items, setItems] = useState<LineMessageTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listTemplates(category, subType)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [category, subType]);

  return (
    <div className={styles.container}>
      <h1>메시지 템플릿</h1>

      <div className={styles.tabs}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={category === c.key ? styles.tabActive : styles.tab}
            disabled={c.disabled}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "SNS" && (
        <div className={styles.filter}>
          <span>Sub-type:</span>
          {SUB_TYPES.map((s) => (
            <label key={s}>
              <input
                type="radio"
                checked={subType === s}
                onChange={() => setSubType(s)}
              />
              {s}
            </label>
          ))}
        </div>
      )}

      {loading ? (
        <p>로딩중...</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Trigger</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Updated By</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.triggerKey}>
                <td>
                  <Link to={`/message-templates/${category}/${subType}/${it.triggerKey}`}>
                    {TRIGGER_LABELS[it.triggerKey]}
                  </Link>
                </td>
                <td>{it.enabled ? "✅ ON" : "⚪ OFF"}</td>
                <td>{it.updatedAt ? new Date(it.updatedAt).toLocaleString("ja-JP") : "-"}</td>
                <td>{it.updatedByName ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
