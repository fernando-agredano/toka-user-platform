interface SegmentedControlProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) => (
  <fieldset className="m-0 inline-flex min-w-0 rounded-md border border-line bg-page p-1">
    <legend className="sr-only">{label}</legend>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          option.value === value ? 'bg-card text-primary shadow-sm' : 'text-ink-soft hover:text-ink'
        }`}
      >
        {option.label}
      </button>
    ))}
  </fieldset>
);
