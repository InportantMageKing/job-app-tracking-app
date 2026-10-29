import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDateTime, formatDay, formatDayShort, monthAgoLocal, STATUS_LABELS, STATUSES, todayLocal } from "./labels";

describe("formatDay", () => {
  it("keeps a date-only string on its own calendar day", () => {
    // new Date("2026-10-20") is midnight UTC, which is still Oct 19 in New York.
    expect(formatDay("2026-10-20")).toBe("Oct 20, 2026");
  });

  it("has a short form without the year", () => {
    expect(formatDayShort("2026-10-26")).toBe("Oct 26");
  });
});

describe("STATUSES", () => {
  it("lists every status in pipeline order, each with a label", () => {
    expect(STATUSES).toEqual(["applied", "phone_screen", "interview", "offer", "rejected", "withdrawn"]);
    for (const status of STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("local date helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayLocal uses the local calendar day, not UTC", () => {
    // 11pm in New York on Oct 28 is already Oct 29 in UTC.
    vi.useFakeTimers({ now: new Date("2026-10-28T23:00:00-04:00") });
    expect(todayLocal()).toBe("2026-10-28");
  });

  it("monthAgoLocal steps back one calendar month", () => {
    vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00-04:00") });
    expect(monthAgoLocal()).toBe("2026-09-28");
  });

  it("formatDateTime shows a readable local date and time", () => {
    expect(formatDateTime("2026-10-27T18:43:00Z")).toBe("Oct 27, 2026, 2:43 PM");
  });
});
