import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listTemplates,
  setTemplateEnabled,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateListItem,
} from "@/domains/messageTemplate";
import { Switch } from "@/components/ui";
import { ScrollTable, SegmentedTabs } from "@/components/composites";
import { useLanguage, useT } from "@/lib/i18n";
import type { AdminTranslationKey } from "@i18n/admin";
import styles from "./MessageTemplates.module.css";

const CATEGORIES: { key: CampaignCategory; labelKey: AdminTranslationKey }[] = [
  { key: "SNS", labelKey: "pages.messageTemplates.categorySns" },
  { key: "FAKE_PURCHASE", labelKey: "pages.messageTemplates.categoryFakePurchase" },
  { key: "SIMPLE_REVIEW", labelKey: "pages.messageTemplates.categorySimpleReview" },
];

const CATEGORY_KEYS = CATEGORIES.map((entry) => entry.key);

function parseCategory(raw: string | null): CampaignCategory {
  return CATEGORY_KEYS.includes(raw as CampaignCategory)
    ? (raw as CampaignCategory)
    : "SNS";
}

export function MessageTemplates(): JSX.Element {
  const t = useT();
  const { language } = useLanguage();
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
      const message =
        err instanceof Error ? err.message : t("pages.messageTemplates.toggleFailed");
      alert(message);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>{t("nav.items.messageTemplates")}</div>
      </div>

      <div className={styles.filters}>
        <SegmentedTabs
          items={CATEGORIES.map((entry) => ({ key: entry.key, label: t(entry.labelKey) }))}
          value={category}
          onChange={setCategory}
        />
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.state}>{t("common.loading")}</div>
        ) : (
          <ScrollTable>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("pages.messageTemplates.headerTrigger")}</th>
                  <th style={{ width: 100 }}>{t("pages.messageTemplates.headerStatus")}</th>
                  <th style={{ width: 180 }}>{t("pages.messageTemplates.headerUpdatedAt")}</th>
                  <th style={{ width: 140 }}>{t("pages.messageTemplates.headerUpdatedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const descriptionKey = TRIGGER_DESCRIPTIONS[item.triggerKey];
                  return (
                    <tr
                      key={item.triggerKey}
                      onClick={() =>
                        navigate(`/message-templates/${category}/${item.triggerKey}`)
                      }
                    >
                      <td>
                        <span className={styles.triggerCell}>
                          {t(TRIGGER_LABELS[item.triggerKey])}
                        </span>
                        {descriptionKey && (
                          <div className={styles.triggerDescription}>{t(descriptionKey)}</div>
                        )}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={item.enabled}
                          onChange={(next) => void handleToggle(item, next)}
                          disabled={pendingKey === item.triggerKey}
                          ariaLabel={t("pages.messageTemplates.toggleAria", {
                            label: t(TRIGGER_LABELS[item.triggerKey]),
                          })}
                        />
                      </td>
                      <td className={styles.mutedCell}>
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString(language) : "-"}
                      </td>
                      <td className={styles.mutedCell}>{item.updatedByName ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </div>
    </div>
  );
}
