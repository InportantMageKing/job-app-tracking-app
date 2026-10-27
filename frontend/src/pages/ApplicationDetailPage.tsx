import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { toApplicationInput, useAddEvent, useApplication, useDeleteApplication, useUpdateApplication } from "../api/applications";
import { ApiError } from "../api/client";
import { AddEventForm } from "../components/AddEventForm";
import { ApplicationDetails } from "../components/ApplicationDetails";
import { ApplicationForm } from "../components/ApplicationForm";
import { StatusBadge } from "../components/StatusBadge";
import { Timeline } from "../components/Timeline";
import { ui } from "../components/ui";

export function ApplicationDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const application = useApplication(id);
  const update = useUpdateApplication(id);
  const addEvent = useAddEvent(id);
  const remove = useDeleteApplication();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await remove.mutateAsync(id);
      navigate("/applications", { replace: true });
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  if (application.isPending) return <p className={ui.muted}>Loading…</p>;
  if (application.isError) {
    const notFound = application.error instanceof ApiError && application.error.status === 404;
    return (
      <div className="space-y-2">
        <p role="alert" className={ui.error}>
          {notFound ? "This application doesn't exist." : application.error.message}
        </p>
        <Link to="/applications" className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-fog hover:text-chalk">
          ← Back to applications
        </Link>
      </div>
    );
  }

  const data = application.data;

  return (
    <div className="space-y-6">
      <Link to="/applications" className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-fog hover:text-chalk">
        ← All applications
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ui.heading}>{data.company}</h1>
          <p className="mt-1 text-lg text-fog">{data.job_title}</p>
        </div>
        <StatusBadge status={data.current_status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={`${ui.card} lg:col-span-2`}>
          {editing ? (
            <ApplicationForm
              initial={toApplicationInput(data)}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                await update.mutateAsync(input);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ApplicationDetails application={data} onEdit={() => setEditing(true)} />
          )}
        </section>

        <section className={`${ui.card} space-y-4`}>
          <h2 className={ui.subheading}>Activity</h2>
          <AddEventForm currentStatus={data.current_status} onSubmit={(event) => addEvent.mutateAsync(event)} />
          <Timeline events={data.events} />
        </section>
      </div>

      <section className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        {confirmingDelete ? (
          <>
            <span className={ui.muted}>Delete this application and its whole timeline?</span>
            <button type="button" className={ui.danger} disabled={remove.isPending} onClick={() => void handleDelete()}>
              Delete
            </button>
            <button type="button" className={ui.secondary} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className={ui.secondary} onClick={() => setConfirmingDelete(true)}>
            Delete application
          </button>
        )}
        {deleteError && (
          <p role="alert" className={ui.error}>
            {deleteError}
          </p>
        )}
      </section>
    </div>
  );
}
