import { useRef, useState, type FormEvent } from "react";

import { useUploadResume } from "../api/resumes";
import type { ResumeVersion } from "../api/types";
import { RESUME_EXTENSIONS, validateResumeFile } from "../lib/resumeFile";
import { ui } from "./ui";

interface Props {
  onUploaded?: (resume: ResumeVersion) => void;
  onCancel?: () => void;
}

export function ResumeUploadForm({ onUploaded, onCancel }: Props) {
  const upload = useUploadResume();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = name.trim() ? validateResumeFile(file) : "Give this version a name.";
    if (problem || !file) {
      setError(problem ?? "Choose a file to upload.");
      return;
    }
    setError(null);
    try {
      const resume = await upload.mutateAsync({ name: name.trim(), description: description.trim(), file });
      setName("");
      setDescription("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onUploaded?.(resume);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className={ui.label}>Name</span>
        <input
          className={ui.input}
          placeholder="e.g. Backend v2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block">
        <span className={ui.label}>Description</span>
        <textarea
          className={ui.input}
          rows={2}
          placeholder="What's different about this version?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="block">
        <span className={ui.label}>File (PDF, DOC, or DOCX, up to 5 MB)</span>
        <input
          ref={fileInput}
          type="file"
          accept={RESUME_EXTENSIONS.join(",")}
          className="mt-1 block w-full text-sm text-fog file:mr-3 file:rounded file:border file:border-rule file:bg-ink file:px-3 file:py-1.5 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-[0.1em] file:text-chalk hover:file:border-fog"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={ui.primary} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
        {onCancel && (
          <button type="button" className={ui.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
