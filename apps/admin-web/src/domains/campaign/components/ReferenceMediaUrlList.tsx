import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./CampaignForm.module.css";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
  errorByIndex?: Record<number, string | undefined>;
};

export function ReferenceMediaUrlList({
  value,
  onChange,
  max = 10,
  disabled,
  placeholder = "https://...",
  errorByIndex,
}: Props) {
  const t = useT();
  const setAt = (index: number, url: string) => {
    const next = value.slice();
    next[index] = url;
    onChange(next);
  };
  const removeAt = (index: number) => {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
  };
  return (
    <div className={styles.urls}>
      {value.map((url, index) => (
        <div key={index} className={styles.urlRow}>
          <input
            type="url"
            className={styles.input}
            placeholder={placeholder}
            value={url}
            disabled={disabled}
            onChange={(event) => setAt(index, event.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeAt(index)}
            disabled={disabled}
            aria-label={t("domains.campaign.referenceUrlList.removeItemAria", {
              index: index + 1,
            })}
          >
            {t("domains.campaign.referenceUrlList.remove")}
          </Button>
          {errorByIndex?.[index] && (
            <div className={styles.error}>{errorByIndex[index]}</div>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        disabled={disabled || value.length >= max}
      >
        {t("domains.campaign.referenceUrlList.addUrl", { count: value.length, max })}
      </Button>
    </div>
  );
}
