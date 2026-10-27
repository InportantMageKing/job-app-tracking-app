import type { PipelineStat } from "../../api/types";
import { STATUS_LINE } from "../../lib/labels";

export function PipelineTiles({ pipeline }: { pipeline: PipelineStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {pipeline.map((row) => (
        <div key={row.status} className="relative overflow-hidden rounded-md border border-rule bg-panel p-4">
          <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${STATUS_LINE[row.status]}`} />
          <div className="font-display text-4xl font-bold leading-none text-chalk">{row.count}</div>
          <div className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-fog">{row.label}</div>
        </div>
      ))}
    </div>
  );
}
