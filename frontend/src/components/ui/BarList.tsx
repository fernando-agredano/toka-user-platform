export interface BarRow {
  label: string;
  value: number;
}

/** One series, one hue: bar length carries the magnitude and every row is labeled directly. */
export const BarList = ({ rows }: { rows: BarRow[] }) => {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-4">
      {rows.map(({ label, value }) => (
        <li key={label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink-soft">{label}</span>
            <span className="font-semibold tabular-nums text-ink">{value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-primary-soft">
            <div
              className="h-full rounded-r rounded-l-full bg-primary"
              style={{ width: `${Math.max((value / maxValue) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
