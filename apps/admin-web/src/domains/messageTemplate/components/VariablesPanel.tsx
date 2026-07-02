import type { TriggerVariable } from "@jsure/shared";

type Props = {
  variables: TriggerVariable[];
  onInsert: (key: string) => void;
};

export function VariablesPanel({ variables, onInsert }: Props): JSX.Element {
  return (
    <div>
      <h3>사용 가능한 변수</h3>
      <p style={{ fontSize: 12, color: "#666" }}>
        태그를 클릭하면 본문 커서 위치에 삽입됩니다.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {variables.map((v) => (
          <button
            key={v.key}
            type="button"
            title={v.description}
            onClick={() => onInsert(v.key)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#f3f4f6",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
