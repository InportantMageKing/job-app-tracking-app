import { useId, useState, type FormEvent } from "react";

import { useResumeVersions } from "../api/resumes";
import type { ApplicationInput, Source } from "../api/types";
import { SOURCE_LABELS, SOURCES, todayLocal } from "../lib/labels";
import { ResumeUploadForm } from "./ResumeUploadForm";
import { ui } from "./ui";

const UPLOAD_NEW = "__upload_new__";

function emptyApplication(): ApplicationInput {
  return {
    company: "",
    job_title: "",
    source: "linkedin",
    link: "",
    date_applied: todayLocal(),
    location: "",
    salary_range: "",
    contact_person: "",
    resume_version: null,
  };
}

interface Props {
  initial?: ApplicationInput;
  submitLabel: string;
  onSubmit: (input: ApplicationInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function ApplicationForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const formId = useId();
  const resumes = useResumeVersions();
  const [values, setValues] = useState<ApplicationInput>(() => initial ?? emptyApplication());
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function handleResumeChange(value: string) {
    if (value === UPLOAD_NEW) {
      setShowUpload(true);
      return;
    }
    set("resume_version", value ? Number(value) : null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const textField = (key: "company" | "job_title" | "location" | "salary_range" | "contact_person", label: string, required = false) => (
    <label className={ui.label}>
      {label}
      <input
        className={ui.input}
        required={required}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      {/* The upload panel is its own <form>, so it sits outside this one; the submit button uses form={formId}. */}
      <form id={formId} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        {textField("company", "Company", true)}
        {textField("job_title", "Job title", true)}
        <label className={ui.label}>
          Source
          <select
            className={ui.input}
            value={values.source}
            onChange={(event) => set("source", event.target.value as Source)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.label}>
          Date applied
          <input
            type="date"
            className={ui.input}
            required
            value={values.date_applied}
            onChange={(event) => set("date_applied", event.target.value)}
          />
        </label>
        <label className={`${ui.label} sm:col-span-2`}>
          Link to posting
          <input
            type="url"
            className={ui.input}
            placeholder="https://"
            value={values.link}
            onChange={(event) => set("link", event.target.value)}
          />
        </label>
        {textField("location", "Location")}
        {textField("salary_range", "Salary range")}
        {textField("contact_person", "Contact person")}
        <label className={ui.label}>
          Resume version
          <select
            className={ui.input}
            value={values.resume_version === null ? "" : String(values.resume_version)}
            onChange={(event) => handleResumeChange(event.target.value)}
          >
            <option value="">No resume</option>
            {resumes.data?.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
              </option>
            ))}
            <option value={UPLOAD_NEW}>+ Upload a new version…</option>
          </select>
        </label>
      </form>

      {showUpload && (
        <section className="rounded-lg border border-dashed border-slate-700 p-4">
          <h3 className="mb-3 text-sm font-semibold">Upload a new resume version</h3>
          <ResumeUploadForm
            onUploaded={(resume) => {
              set("resume_version", resume.id);
              setShowUpload(false);
            }}
            onCancel={() => setShowUpload(false)}
          />
        </section>
      )}

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" form={formId} className={ui.primary} disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={ui.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
