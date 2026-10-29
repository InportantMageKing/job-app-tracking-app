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
    ["Date applied", <span className={ui.data}>{formatDay(application.date_applied)}</span>],
    ["Location", application.location || "—"],
    ["Salary range", application.salary_range ? <span className={ui.data}>{application.salary_range}</span> : "—"],
    ["Contact person", application.contact_person || "—"],
    ["Resume version", application.resume_version_name ?? "—"],
    [
      "Posting",
      application.link ? (
        <a href={application.link} target="_blank" rel="noopener noreferrer" className="break-all text-signal hover:underline">
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
        <h2 className={ui.subheading}>Details</h2>
        <button type="button" className={ui.secondary} onClick={onEdit}>
          Edit details
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className={ui.label}>{label}</dt>
            <dd className="mt-1 text-sm text-chalk">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
