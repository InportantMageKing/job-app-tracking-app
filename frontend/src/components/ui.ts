/** Shared Tailwind class strings so every form control and button looks the same. */
export const ui = {
  input:
    "mt-1 block w-full rounded border border-rule bg-ink px-3 py-2 text-sm text-chalk placeholder:text-fog/70 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal",
  label: "block font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog",
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded bg-signal px-4 py-2 font-display text-sm font-bold uppercase tracking-[0.1em] text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded border border-rule px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-chalk hover:border-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded bg-line-rejected px-4 py-2 font-display text-sm font-bold uppercase tracking-[0.1em] text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-rejected disabled:opacity-50",
  card: "rounded-md border border-rule bg-panel p-5",
  inset: "rounded-md border border-dashed border-rule p-4",
  error: "text-sm text-line-rejected",
  heading: "font-display text-3xl font-bold uppercase tracking-[0.06em] text-chalk",
  subheading: "font-display text-base font-semibold uppercase tracking-[0.12em] text-chalk",
  muted: "text-sm text-fog",
  data: "font-mono tabular-nums",
};
