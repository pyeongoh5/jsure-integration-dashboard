import type { TriggerVariable } from "@jsure/shared";
import styles from "./VariablesPanel.module.css";

type Props = {
  variables: TriggerVariable[];
  onInsert: (key: string) => void;
};

export function VariablesPanel({ variables, onInsert }: Props): JSX.Element {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>사용 가능한 변수</div>
        <div className={styles.hint}>태그를 클릭하면 본문 커서 위치에 삽입됩니다.</div>
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
