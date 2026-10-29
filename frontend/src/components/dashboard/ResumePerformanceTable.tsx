import type { ResumePerformance, Status } from "../../api/types";
import { ui } from "../ui";

const COLUMNS: { stage: Status; label: string }[] = [
  { stage: "phone_screen", label: "Phone screen" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
];

const HEADER = "py-2 pr-4 font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog";

export function ResumePerformanceTable({ rows }: { rows: ResumePerformance[] }) {
  if (rows.length === 0) return <p className={ui.muted}>No resume versions yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-rule text-left">
          <tr>
            <th className={HEADER}>Resume</th>
            <th className={HEADER}>Applications</th>
            {COLUMNS.map((column) => (
              <th key={column.stage} className={HEADER}>
                Reached {column.label.toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((row) => (
            <tr key={row.resume_version_id ?? "none"}>
              <td className="py-2.5 pr-4 font-medium text-chalk">
                {row.resume_version_id === null ? "No resume" : row.name}
              </td>
              <td className={`py-2.5 pr-4 text-chalk ${ui.data}`}>{row.total}</td>
              {COLUMNS.map((column) => {
                const stat = row.stages.find((stage) => stage.stage === column.stage);
                return (
                  <td key={column.stage} className={`py-2.5 pr-4 text-chalk ${ui.data}`}>
                    {stat ? `${stat.percent}% (${stat.count})` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
