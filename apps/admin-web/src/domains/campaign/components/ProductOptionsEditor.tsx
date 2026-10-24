import { useState } from "react";
import type { CampaignProductOption } from "@jsure/shared";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./CampaignForm.module.css";

type Props = {
  value: CampaignProductOption[];
  onChange: (next: CampaignProductOption[]) => void;
  max?: number;
  disabled?: boolean;
};

/** "19호, 21호" → ["19호", "21호"]. 빈 조각은 버린다. */
function parseValues(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function ProductOptionsEditor({
  value,
  onChange,
  max = 10,
  disabled,
}: Props) {
  const t = useT();
  // 쉼표 입력 중간 상태("21호, ")를 보존하려고 입력 텍스트를 따로 들고 있는다.
  const [valueTexts, setValueTexts] = useState<string[]>(() =>
    value.map((group) => group.values.join(", ")),
  );

  const setName = (index: number, name: string) => {
    const next = value.slice();
    next[index] = { ...next[index]!, name };
    onChange(next);
  };
  const setValues = (index: number, text: string) => {
    const nextTexts = valueTexts.slice();
    nextTexts[index] = text;
    setValueTexts(nextTexts);
    const next = value.slice();
    next[index] = { ...next[index]!, values: parseValues(text) };
    onChange(next);
  };
  const removeAt = (index: number) => {
    const nextTexts = valueTexts.slice();
    nextTexts.splice(index, 1);
    setValueTexts(nextTexts);
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    setValueTexts([...valueTexts, ""]);
    onChange([...value, { name: "", values: [] }]);
  };

  return (
    <div className={styles.urls}>
      {value.length === 0 && (
        <p className={styles.hint}>{t("domains.campaign.productOptions.none")}</p>
      )}
      {value.map((group, index) => (
        <div key={index} className={styles.urlRow}>
          <input
            className={styles.input}
            aria-label={t("domains.campaign.productOptions.nameLabel")}
            placeholder={t("domains.campaign.productOptions.namePlaceholder")}
            value={group.name}
            disabled={disabled}
            onChange={(event) => setName(index, event.target.value)}
          />
          <input
            className={styles.input}
            aria-label={t("domains.campaign.productOptions.valuesLabel")}
            placeholder={t("domains.campaign.productOptions.valuesPlaceholder")}
            value={valueTexts[index] ?? group.values.join(", ")}
            disabled={disabled}
            onChange={(event) => setValues(index, event.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeAt(index)}
            disabled={disabled}
            aria-label={t("domains.campaign.productOptions.removeAria", {
              index: index + 1,
            })}
          >
            {t("domains.campaign.productOptions.remove")}
          </Button>
        </div>
      ))}
      <p className={styles.hint}>{t("domains.campaign.productOptions.valuesHint")}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        disabled={disabled || value.length >= max}
      >
        {t("domains.campaign.productOptions.add", { count: value.length, max })}
      </Button>
    </div>
  );
}
