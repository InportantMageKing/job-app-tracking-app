import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useApplications, type ApplicationFilters } from "../api/applications";
import type { Source, Status } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { ui } from "../components/ui";
import { formatDay, SOURCE_LABELS, SOURCES, STATUS_LABELS, STATUSES } from "../lib/labels";

export function ApplicationsPage() {
  const [filters, setFilters] = useState<ApplicationFilters>({ status: "", source: "", search: "" });
  const applications = useApplications(filters);
  const navigate = useNavigate();

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

      {applications.isPending ? (
        <p className={ui.muted}>Loading…</p>
      ) : applications.isError ? (
        <p role="alert" className={ui.error}>
          {applications.error.message}
        </p>
      ) : applications.data.length === 0 ? (
        <div className={`${ui.card} text-center text-fog`}>No applications match these filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-rule bg-ink">
          <table className="min-w-full text-sm">
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
            <tbody className="divide-y divide-rule">
              {applications.data.map((application) => (
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
