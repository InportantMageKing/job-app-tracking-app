import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useApplications, type ApplicationFilters } from "../api/applications";
import type { Source, Status } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { Toggle } from "../components/Toggle";
import { ui } from "../components/ui";
import { formatDay, monthAgoLocal, SOURCE_LABELS, SOURCES, STATUS_LABELS, STATUSES } from "../lib/labels";

const CLOSED_STATUSES: Status[] = ["rejected", "withdrawn"];

export function ApplicationsPage() {
  const [filters, setFilters] = useState<ApplicationFilters>({ status: "", source: "", search: "" });
  const applications = useApplications(filters);
  const [hideClosed, setHideClosed] = useState(false);
  const [hideOlder, setHideOlder] = useState(false);
  const navigate = useNavigate();

  // Picking a status by name always shows it, so the toggle only applies to "All statuses".
  const hidingClosed = hideClosed && filters.status === "";
  const cutoff = monthAgoLocal();
  const rows = (applications.data ?? []).filter(
    (application) =>
      (!hidingClosed || !CLOSED_STATUSES.includes(application.current_status)) &&
      (!hideOlder || application.date_applied >= cutoff),
  );

  function update(patch: ApplicationFilters) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  return (
    <div className="space-y-4">
      <h1 className={ui.heading}>Applications</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search company or role"
          placeholder="Search company or role"
          className={ui.input}
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
        />
        <select
          aria-label="Filter by status"
          className={ui.input}
          value={filters.status}
          onChange={(event) => update({ status: event.target.value as Status | "" })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by source"
          className={ui.input}
          value={filters.source}
          onChange={(event) => update({ source: event.target.value as Source | "" })}
        >
          <option value="">All sources</option>
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Toggle
          label="Hide rejected and withdrawn"
          checked={hidingClosed}
          disabled={filters.status !== ""}
          onChange={setHideClosed}
        />
        <Toggle label="Hide applied over a month ago" checked={hideOlder} onChange={setHideOlder} />
      </div>

      {applications.isPending ? (
        <p className={ui.muted}>Loading…</p>
      ) : applications.isError ? (
        <p role="alert" className={ui.error}>
          {applications.error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className={`${ui.card} text-center text-fog`}>No applications match these filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-rule bg-ink">
          <table className="w-full min-w-[56rem] table-fixed text-sm">
            {/* Fixed widths so columns don't jump when filters change which rows are shown. */}
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[24%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead className="border-b border-rule text-left font-display text-xs font-semibold uppercase tracking-[0.12em] text-fog">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule break-words">
              {rows.map((application) => (
                <tr
                  key={application.id}
                  className="group cursor-pointer hover:bg-panel"
                  onClick={(event) => {
                    // The company link handles its own click; the rest of the row navigates for mouse users.
                    if ((event.target as HTMLElement).closest("a")) return;
                    void navigate(`/applications/${application.id}`);
                  }}
                >
                  <td className="px-4 py-3">
                    <Link to={`/applications/${application.id}`} className="font-medium text-chalk group-hover:text-signal">
                      {application.company}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-chalk">{application.job_title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.current_status} />
                  </td>
                  <td className="px-4 py-3 text-fog">{SOURCE_LABELS[application.source]}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-chalk ${ui.data}`}>{formatDay(application.date_applied)}</td>
                  <td className="px-4 py-3 text-fog">{application.resume_version_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
