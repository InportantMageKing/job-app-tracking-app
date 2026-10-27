import type { WeekStat } from "../../api/types";
import { formatDayShort } from "../../lib/labels";

export function WeeklyChart({ weeks }: { weeks: WeekStat[] }) {
  if (weeks.length === 0) return null;
  const busiest = Math.max(1, ...weeks.map((week) => week.count));

  return (
    <div>
      <ul className="flex h-40 items-end gap-1.5">
        {weeks.map((week) => {
          const label = `Week of ${formatDayShort(week.week_start)}: ${week.count} application${week.count === 1 ? "" : "s"}`;
          return (
            <li key={week.week_start} aria-label={label} title={label} className="flex h-full flex-1 flex-col justify-end">
              <div className="rounded-t bg-slate-800" style={{ height: `${(week.count / busiest) * 100}%` }} />
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{formatDayShort(weeks[0].week_start)}</span>
        <span>{formatDayShort(weeks[weeks.length - 1].week_start)}</span>
      </div>
    </div>
  );
}
