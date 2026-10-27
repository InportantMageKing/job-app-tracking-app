import type { PipelineStat } from "../../api/types";
import { STATUS_COLORS } from "../../lib/labels";

export function PipelineTiles({ pipeline }: { pipeline: PipelineStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {pipeline.map((row) => (
        <div key={row.status} className={`rounded-lg p-3 ${STATUS_COLORS[row.status]}`}>
          <div className="text-2xl font-semibold">{row.count}</div>
          <div className="text-xs font-medium">{row.label}</div>
        </div>
      ))}
    </div>
  );
}
