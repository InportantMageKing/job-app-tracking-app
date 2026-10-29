import { useState } from "react";

import { downloadResume, useDeleteResume, useResumeVersions } from "../api/resumes";
import type { ResumeVersion } from "../api/types";
import { ResumeUploadForm } from "../components/ResumeUploadForm";
import { ui } from "../components/ui";
import { formatDateTime } from "../lib/labels";

export function ResumesPage() {
  const resumes = useResumeVersions();
  const remove = useDeleteResume();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Errors are kept per resume so each one shows on the card it belongs to.
  const [errors, setErrors] = useState<Record<number, string>>({});

  function setError(id: number, message: string | null) {
    setErrors((previous) => {
      const next = { ...previous };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function handleDownload(resume: ResumeVersion) {
    setError(resume.id, null);
    try {
      await downloadResume(resume);
    } catch (caught) {
      setError(resume.id, caught instanceof Error ? caught.message : "Download failed.");
    }
  }

  async function handleDelete(id: number) {
    setError(id, null);
    try {
      await remove.mutateAsync(id);
      setConfirmingId(null);
    } catch (caught) {
      setError(id, caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className={ui.heading}>Resume versions</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {resumes.isPending ? (
            <p className={ui.muted}>Loading…</p>
          ) : resumes.isError ? (
            <p role="alert" className={ui.error}>
              {resumes.error.message}
            </p>
          ) : resumes.data.length === 0 ? (
            <div className={`${ui.card} text-fog`}>No resume versions yet. Upload your first one.</div>
          ) : (
            resumes.data.map((resume) => (
              <article key={resume.id} className={`${ui.card} space-y-2`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={ui.subheading}>{resume.name}</h2>
                  <span className="text-xs text-fog">
                    Uploaded <span className={ui.data}>{formatDateTime(resume.created_at)}</span>
                  </span>
                </div>
                {resume.description && <p className="text-sm text-chalk/90">{resume.description}</p>}
                <p className={ui.muted}>
                  Used in <span className={ui.data}>{resume.application_count}</span> application{resume.application_count === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`${ui.secondary} min-w-0 max-w-full`}
                    title={resume.original_filename}
                    onClick={() => void handleDownload(resume)}
                  >
                    {/* Long filenames are cut off with an ellipsis; the full name is in the tooltip. */}
                    <span className="truncate">Download {resume.original_filename}</span>
                  </button>
                  {confirmingId === resume.id ? (
                    <>
                      <span className={ui.muted}>Delete this version? Applications using it will show no resume.</span>
                      <button
                        type="button"
                        className={ui.danger}
                        disabled={remove.isPending}
                        onClick={() => void handleDelete(resume.id)}
                      >
                        Delete
                      </button>
                      <button type="button" className={ui.secondary} onClick={() => setConfirmingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className={ui.secondary} onClick={() => setConfirmingId(resume.id)}>
                      Delete
                    </button>
                  )}
                </div>
                {errors[resume.id] && (
                  <p role="alert" className={ui.error}>
                    {errors[resume.id]}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
        <section className={`${ui.card} h-fit space-y-3`}>
          <h2 className={ui.subheading}>Upload a new version</h2>
          <ResumeUploadForm />
        </section>
      </div>
    </div>
  );
}
