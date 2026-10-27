import type { ApplicationEvent } from "../api/types";
import { formatDateTime, STATUS_LABELS } from "../lib/labels";

function describe(event: ApplicationEvent): string {
  if (event.event_type === "note") return "Note";
  if (event.from_status === null) return "Application created";
  return `${STATUS_LABELS[event.from_status]} → ${event.to_status ? STATUS_LABELS[event.to_status] : "?"}`;
}

export function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-slate-400">No activity yet.</p>;

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li
          key={event.id}
          className={`rounded-md border p-3 ${
            event.event_type === "note" ? "border-slate-800 bg-slate-800/50" : "border-slate-700 bg-slate-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{describe(event)}</span>
            <time className="text-xs text-slate-400" dateTime={event.created_at}>
              {formatDateTime(event.created_at)}
            </time>
          </div>
          {event.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}
