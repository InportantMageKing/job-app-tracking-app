import type { Status } from "../api/types";
import { STATUS_LABELS, STATUS_LINE } from "../lib/labels";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-chalk">
      <span data-line className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_LINE[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
