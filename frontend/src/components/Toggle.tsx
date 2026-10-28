/** An on/off switch styled to match the filter bar. */
export function Toggle({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog hover:text-chalk focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal disabled:opacity-50 disabled:hover:text-fog"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full border border-rule transition-colors ${checked ? "bg-signal" : "bg-ink"}`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left] ${
            checked ? "left-[18px] bg-ink" : "left-0.5 bg-fog"
          }`}
        />
      </span>
      {label}
    </button>
  );
}
