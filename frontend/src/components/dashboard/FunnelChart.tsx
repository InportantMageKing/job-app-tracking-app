import type { StageStat } from "../../api/types";

export function FunnelChart({ stages }: { stages: StageStat[] }) {
  return (
    <ul className="space-y-3">
      {stages.map((stage) => (
        <li key={stage.stage} aria-label={`${stage.label}: ${stage.count} (${stage.percent}%)`}>
          <div className="flex justify-between text-sm">
            <span>{stage.label}</span>
            <span className="text-slate-400">
              {stage.count} ({stage.percent}%)
            </span>
          </div>
          <div className="mt-1 h-3 rounded-full bg-slate-800">
            <div
              data-testid={`funnel-bar-${stage.stage}`}
              className="h-3 rounded-full bg-sky-500"
              style={{ width: `${stage.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
