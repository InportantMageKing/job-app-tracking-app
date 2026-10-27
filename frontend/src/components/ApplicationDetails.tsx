import type { ReactNode } from "react";

import type { Application } from "../api/types";
import { formatDay, SOURCE_LABELS } from "../lib/labels";
import { ui } from "./ui";

interface Props {
  application: Application;
  onEdit: () => void;
}

export function ApplicationDetails({ application, onEdit }: Props) {
  const rows: [string, ReactNode][] = [
    ["Source", SOURCE_LABELS[application.source]],
    ["Date applied", formatDay(application.date_applied)],
    ["Location", application.location || "—"],
    ["Salary range", application.salary_range || "—"],
    ["Contact person", application.contact_person || "—"],
    ["Resume version", application.resume_version_name ?? "—"],
    [
      "Posting",
      application.link ? (
        <a href={application.link} target="_blank" rel="noopener noreferrer" className="break-all text-sky-700 hover:underline">
          {application.link}
        </a>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Details</h2>
        <button type="button" className={ui.secondary} onClick={onEdit}>
          Edit details
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
