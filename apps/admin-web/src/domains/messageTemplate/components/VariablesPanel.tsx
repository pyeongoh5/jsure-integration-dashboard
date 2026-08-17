import type { TriggerVariable } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import styles from "./VariablesPanel.module.css";

type Props = {
  variables: TriggerVariable[];
  onInsert: (key: string) => void;
};

export function VariablesPanel({ variables, onInsert }: Props): JSX.Element {
  const t = useT();
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>{t("domains.messageTemplate.variablesPanel.title")}</div>
        <div className={styles.hint}>{t("domains.messageTemplate.variablesPanel.hint")}</div>
      </div>
      <div className={styles.chips}>
        {variables.map((v) => (
          <button
            key={v.key}
            type="button"
            title={v.description}
            onClick={() => onInsert(v.key)}
            className={styles.chip}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
