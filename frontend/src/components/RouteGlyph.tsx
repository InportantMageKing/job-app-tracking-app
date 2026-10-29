/** Three stations on a line; the last one is hollow, read as "next stop". */
export function RouteGlyph({ large = false }: { large?: boolean }) {
  const [width, height, inset, r, line, ring] = large ? [80, 16, 8, 5.5, 3, 3] : [34, 10, 5, 3.5, 2, 2];
  const y = height / 2;
  const end = width - inset;
  const mid = width / 2;
  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      <line x1={inset} y1={y} x2={end} y2={y} stroke="var(--color-fog)" strokeWidth={line} />
      <circle cx={inset} cy={y} r={r} fill="var(--color-line-phone_screen)" />
      <circle cx={mid} cy={y} r={r} fill="var(--color-line-interview)" />
      <circle cx={end} cy={y} r={r} fill="var(--color-ink)" stroke="var(--color-line-offer)" strokeWidth={ring} />
    </svg>
  );
}
