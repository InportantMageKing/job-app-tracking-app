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
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(resume: ResumeVersion) {
    setError(null);
    try {
      await downloadResume(resume);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Download failed.");
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await remove.mutateAsync(id);
      setConfirmingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className={ui.heading}>Resume versions</h1>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {resumes.isPending ? (
            <p className="text-slate-400">Loading…</p>
          ) : resumes.isError ? (
            <p role="alert" className={ui.error}>
              {resumes.error.message}
            </p>
          ) : resumes.data.length === 0 ? (
            <div className={`${ui.card} text-slate-400`}>No resume versions yet. Upload your first one.</div>
          ) : (
            resumes.data.map((resume) => (
              <article key={resume.id} className={`${ui.card} space-y-2`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{resume.name}</h2>
                  <span className="text-xs text-slate-400">Uploaded {formatDateTime(resume.created_at)}</span>
                </div>
                {resume.description && <p className="text-sm text-slate-300">{resume.description}</p>}
                <p className="text-sm text-slate-400">
                  Used in {resume.application_count} application{resume.application_count === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={ui.secondary} onClick={() => void handleDownload(resume)}>
                    Download {resume.original_filename}
                  </button>
                  {confirmingId === resume.id ? (
                    <>
                      <span className="text-sm text-slate-400">Delete this version? Applications using it will show no resume.</span>
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
              </article>
            ))
          )}
        </div>
        <section className={`${ui.card} h-fit space-y-3`}>
          <h2 className="font-semibold">Upload a new version</h2>
          <ResumeUploadForm />
        </section>
      </div>
    </div>
  );
}
