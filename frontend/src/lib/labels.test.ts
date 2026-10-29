import { describe, expect, it } from "vitest";

import { formatDay, formatDayShort, STATUS_LABELS, STATUSES } from "./labels";

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
