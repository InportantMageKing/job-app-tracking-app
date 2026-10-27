import { useState, type FormEvent } from "react";

import type { NewEvent, Status } from "../api/types";
import { STATUS_LABELS, STATUSES } from "../lib/labels";
import { ui } from "./ui";

interface Props {
  currentStatus: Status;
  onSubmit: (event: NewEvent) => Promise<unknown>;
}

type Mode = "note" | "status_change";

export function AddEventForm({ currentStatus, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>("note");
  const [toStatus, setToStatus] = useState<Status | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    let payload: NewEvent;
    if (mode === "note") {
      if (!text) {
        setError("Write a note before saving.");
        return;
      }
      payload = { event_type: "note", note: text };
    } else {
      if (!toStatus) {
        setError("Pick the new status.");
        return;
      }
      payload = { event_type: "status_change", to_status: toStatus, note: text };
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(payload);
      setNote("");
      setToStatus("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => switchMode(value)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
        mode === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
        {modeButton("note", "Add note")}
        {modeButton("status_change", "Change status")}
      </div>

      {mode === "status_change" && (
        <label className={ui.label}>
          New status
          <select
            className={ui.input}
            value={toStatus}
            onChange={(event) => setToStatus(event.target.value as Status | "")}
          >
            <option value="">Choose…</option>
            {STATUSES.filter((status) => status !== currentStatus).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={ui.label}>
        {mode === "note" ? "Note" : "Note (optional)"}
        <textarea
          className={ui.input}
          rows={3}
          placeholder={mode === "note" ? "e.g. Recruiter emailed to schedule a call" : "Anything worth remembering"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <button type="submit" className={ui.primary} disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
