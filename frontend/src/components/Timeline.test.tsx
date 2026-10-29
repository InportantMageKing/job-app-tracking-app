import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ApplicationEvent } from "../api/types";
import { Timeline } from "./Timeline";

const events: ApplicationEvent[] = [
  {
    id: 3,
    event_type: "note",
    from_status: null,
    to_status: null,
    note: "Recruiter emailed about scheduling",
    created_at: "2026-10-22T15:00:00Z",
  },
  {
    id: 2,
    event_type: "status_change",
    from_status: "phone_screen",
    to_status: "interview",
    note: "Onsite on Friday",
    created_at: "2026-10-21T15:00:00Z",
  },
  {
    id: 1,
    event_type: "status_change",
    from_status: null,
    to_status: "applied",
    note: "",
    created_at: "2026-10-20T15:00:00Z",
  },
];

describe("Timeline", () => {
  it("renders events in the order given, newest first", () => {
    render(<Timeline events={events} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Note");
    expect(items[0]).toHaveTextContent("Recruiter emailed about scheduling");
    expect(items[1]).toHaveTextContent("Phone Screen → Interview");
    expect(items[1]).toHaveTextContent("Onsite on Friday");
    expect(items[2]).toHaveTextContent("Application created");
  });

  it("shows when each event happened", () => {
    render(<Timeline events={events} />);
    expect(screen.getAllByRole("listitem")[0].querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-10-22T15:00:00Z",
    );
  });

  it("shows an empty state", () => {
    render(<Timeline events={[]} />);
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });
});
