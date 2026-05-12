import "./FilterChips.css";

type FilterOption<K extends string> = { key: K; label: string };

type FilterChipsProps<K extends string> = {
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
};

export function FilterChips<K extends string>({
  options,
  value,
  onChange,
}: FilterChipsProps<K>) {
  return (
    <div className="ui-filter-chips">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`ui-filter-chips__chip ${
            value === o.key ? "ui-filter-chips__chip--active" : ""
          }`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
