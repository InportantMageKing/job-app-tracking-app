import type { ApplicationEvent } from "../api/types";
import { formatDateTime, STATUS_LABELS, STATUS_LINE } from "../lib/labels";

function describe(event: ApplicationEvent): string {
  if (event.event_type === "note") return "Note";
  if (event.from_status === null) return "Application created";
  return `${STATUS_LABELS[event.from_status]} → ${event.to_status ? STATUS_LABELS[event.to_status] : "?"}`;
}

function markerClass(event: ApplicationEvent): string {
  if (event.event_type === "note") return "left-[3px] top-1.5 h-2 w-2 border-2 border-fog bg-panel";
  const line = event.from_status !== null && event.to_status ? STATUS_LINE[event.to_status] : "bg-line-applied";
  return `left-0 top-[3px] h-3.5 w-3.5 ring-4 ring-panel ${line}`;
}

/** Events as stops on a vertical route; each item draws the line down to the next stop. */
export function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-fog">No activity yet.</p>;

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const isNote = event.event_type === "note";
        return (
          <li key={event.id} className="relative pl-7 pb-5 last:pb-0">
            {index < events.length - 1 && (
              <span aria-hidden="true" className="absolute left-[6px] top-2.5 -bottom-2.5 w-0.5 bg-rule" />
            )}
            <span aria-hidden="true" className={`absolute rounded-full ${markerClass(event)}`} />
            <div
              className={`text-sm leading-5 ${
                isNote ? "text-fog" : "font-display font-semibold uppercase tracking-[0.08em] text-chalk"
              }`}
            >
              {describe(event)}
            </div>
            <time className="mt-0.5 block font-mono text-xs text-fog" dateTime={event.created_at}>
              {formatDateTime(event.created_at)}
            </time>
            {event.note && <p className="mt-1 whitespace-pre-wrap text-sm text-chalk/90">{event.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
