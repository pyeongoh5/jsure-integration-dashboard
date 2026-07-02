import type { TriggerVariable } from "@jsure/shared";

type Props = {
  variables: TriggerVariable[];
  onInsert: (key: string) => void;
};

export function VariablesPanel({ variables, onInsert }: Props): JSX.Element {
  return (
    <div>
      <h3>Available Variables</h3>
      {variables.map((v) => (
        <div key={v.key} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{v.label}</div>
          <div style={{ color: "#666", fontSize: 13 }}>{v.description}</div>
          <button onClick={() => onInsert(v.key)}>Insert</button>
        </div>
      ))}
    </div>
  );
}
