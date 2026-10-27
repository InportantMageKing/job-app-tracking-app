import type { StageStat, Status } from "../../api/types";
import { STATUS_LINE } from "../../lib/labels";

const STATION_RING: Record<Status, string> = {
  applied: "border-line-applied",
  phone_screen: "border-line-phone_screen",
  interview: "border-line-interview",
  offer: "border-line-offer",
  rejected: "border-line-rejected",
  withdrawn: "border-line-withdrawn",
};

const SEGMENT = "absolute top-1.5 hidden h-1 sm:block";

/** The funnel as a route: stations on one line, colored up to the last stop anyone reached. */
export function FunnelChart({ stages }: { stages: StageStat[] }) {
  return (
    <ul className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
      {stages.map((stage, index) => {
        const next = stages[index + 1];
        const reached = stage.count > 0;
        return (
          <li
            key={stage.stage}
            aria-label={`${stage.label}: ${stage.count} (${stage.percent}%)`}
            className="flex flex-col items-center text-center"
          >
            <div className="relative flex h-4 w-full items-center justify-center">
              {index > 0 && (
                <span aria-hidden="true" className={`${SEGMENT} left-0 right-1/2 ${reached ? STATUS_LINE[stage.stage] : "bg-rule"}`} />
              )}
              {next && (
                <span
                  aria-hidden="true"
                  className={`${SEGMENT} left-1/2 right-0 ${next.count > 0 ? STATUS_LINE[next.stage] : "bg-rule"}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative h-4 w-4 rounded-full border-[3px] ${STATION_RING[stage.stage]} ${
                  reached ? STATUS_LINE[stage.stage] : "bg-ink"
                }`}
              />
            </div>
            <div className="mt-3 whitespace-nowrap font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog">
              {stage.label}
            </div>
            <div className="mt-1 font-display text-3xl font-bold leading-none text-chalk">{stage.count}</div>
            <div className="mt-1 font-mono text-sm text-fog">{stage.percent}%</div>
            <div className="mt-3 w-full px-4">
              <div className="h-1 overflow-hidden rounded-full bg-rule">
                <div
                  data-testid={`funnel-bar-${stage.stage}`}
                  className={`h-1 rounded-full ${STATUS_LINE[stage.stage]}`}
                  style={{ width: `${stage.percent}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
