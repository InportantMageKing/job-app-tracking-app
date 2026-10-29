import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationFilters } from "../api/applications";
import type { Application, Status } from "../api/types";
import { ApplicationsPage } from "./ApplicationsPage";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString("en-CA");
}

function application(id: number, company: string, current_status: Status, date_applied = daysAgo(3)): Application {
  return {
    id,
    company,
    job_title: "Engineer",
    source: "linkedin",
    link: "",
    date_applied,
    location: "",
    salary_range: "",
    contact_person: "",
    resume_version: null,
    resume_version_name: null,
    current_status,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

const allApplications = [
  application(1, "Open Co", "interview"),
  application(2, "Rejected Co", "rejected"),
  application(3, "Withdrawn Co", "withdrawn"),
  application(4, "Old Co", "applied", daysAgo(45)),
];

// The mock returns `data` and records the filters each render asked for.
let data: Application[] = allApplications;
const useApplications = vi.fn((_filters: ApplicationFilters) => ({ isPending: false, isError: false, data }));

vi.mock("../api/applications", () => ({
  useApplications: (filters: ApplicationFilters) => useApplications(filters),
}));

beforeEach(() => {
  data = allApplications;
  useApplications.mockClear();
});

function renderPage() {
  render(
    <MemoryRouter>
      <ApplicationsPage />
    </MemoryRouter>,
  );
}

describe("ApplicationsPage toggles", () => {
  it("hides rejected and withdrawn applications when switched on", async () => {
    renderPage();
    expect(screen.getByText("Rejected Co")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Hide rejected and withdrawn" }));

    expect(screen.getByRole("switch", { name: "Hide rejected and withdrawn" })).toBeChecked();
    expect(screen.getByText("Open Co")).toBeInTheDocument();
    expect(screen.queryByText("Rejected Co")).not.toBeInTheDocument();
    expect(screen.queryByText("Withdrawn Co")).not.toBeInTheDocument();
  });

  it("is disabled while a specific status is selected", async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "rejected");
    expect(screen.getByRole("switch", { name: "Hide rejected and withdrawn" })).toBeDisabled();
  });

  it("hides applications applied more than a month ago", async () => {
    renderPage();
    expect(screen.getByText("Old Co")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Hide applied over a month ago" }));

    expect(screen.queryByText("Old Co")).not.toBeInTheDocument();
    expect(screen.getByText("Open Co")).toBeInTheDocument();
  });
});

describe("ApplicationsPage empty states", () => {
  it("invites you to add one when there are no applications at all", () => {
    data = [];
    renderPage();
    expect(screen.getByText("No applications yet. Use New application to add your first one.")).toBeInTheDocument();
  });

  it("says nothing matches when filters hide every row", async () => {
    data = [application(2, "Rejected Co", "rejected")];
    renderPage();
    await userEvent.click(screen.getByRole("switch", { name: "Hide rejected and withdrawn" }));
    expect(screen.getByText("No applications match these filters.")).toBeInTheDocument();
  });
});

describe("ApplicationsPage search", () => {
  it("waits for a pause in typing before searching", () => {
    vi.useFakeTimers();
    try {
      renderPage();
      fireEvent.change(screen.getByLabelText("Search company or role"), { target: { value: "acme" } });
      expect(useApplications).not.toHaveBeenLastCalledWith(expect.objectContaining({ search: "acme" }));

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(useApplications).toHaveBeenLastCalledWith(expect.objectContaining({ search: "acme" }));
    } finally {
      vi.useRealTimers();
    }
  });
});
