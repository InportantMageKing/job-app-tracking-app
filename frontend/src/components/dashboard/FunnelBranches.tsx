import type { PipelineStat, Status } from "../../api/types";
import { STATUS_LINE } from "../../lib/labels";

const BRANCH_STATUSES: Status[] = ["rejected", "withdrawn"];

const SPUR_STROKE: Record<Status, string> = {
  applied: "text-line-applied",
  phone_screen: "text-line-phone_screen",
  interview: "text-line-interview",
  offer: "text-line-offer",
  rejected: "text-line-rejected",
  withdrawn: "text-line-withdrawn",
};

/** The two ways off the main line, drawn as spurs: how many applications currently end there. */
export function FunnelBranches({ pipeline, total }: { pipeline: PipelineStat[]; total: number }) {
  const branches = pipeline.filter((row) => BRANCH_STATUSES.includes(row.status));

  return (
    <div className="border-t border-rule pt-5">
      <div className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog">Branch lines</div>
      <ul className="mt-3 space-y-3">
        {branches.map((branch) => {
          const percent = total > 0 ? Math.round((branch.count / total) * 1000) / 10 : 0;
          return (
            <li
              key={branch.status}
              aria-label={`${branch.label}: ${branch.count} (${percent}%)`}
              className="flex items-center gap-3"
            >
              <svg aria-hidden="true" viewBox="0 0 36 20" className={`h-5 w-9 shrink-0 ${SPUR_STROKE[branch.status]}`}>
                <path d="M2 3 C 14 3, 14 17, 26 17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <circle cx="29" cy="17" r="5" fill="currentColor" />
              </svg>
              <span className="w-24 shrink-0 font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog">
                {branch.label}
              </span>
              <span className="w-10 shrink-0 font-display text-2xl font-bold leading-none text-chalk">{branch.count}</span>
              <span className="w-12 shrink-0 font-mono text-sm text-fog">{percent}%</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-rule">
                <div
                  data-testid={`branch-bar-${branch.status}`}
                  className={`h-1 rounded-full ${STATUS_LINE[branch.status]}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
