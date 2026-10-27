import type { ResumePerformance, Status } from "../../api/types";

const COLUMNS: { stage: Status; label: string }[] = [
  { stage: "phone_screen", label: "Phone screen" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
];

export function ResumePerformanceTable({ rows }: { rows: ResumePerformance[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">No resume versions yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-2 pr-4">Resume</th>
            <th className="py-2 pr-4">Applications</th>
            {COLUMNS.map((column) => (
              <th key={column.stage} className="py-2 pr-4">
                Reached {column.label.toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.resume_version_id ?? "none"}>
              <td className="py-2 pr-4 font-medium">{row.resume_version_id === null ? "No resume" : row.name}</td>
              <td className="py-2 pr-4">{row.total}</td>
              {COLUMNS.map((column) => {
                const stat = row.stages.find((stage) => stage.stage === column.stage);
                return (
                  <td key={column.stage} className="py-2 pr-4">
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
