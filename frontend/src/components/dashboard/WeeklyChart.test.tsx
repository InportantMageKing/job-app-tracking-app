import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeekStat } from "../../api/types";
import { WeeklyChart } from "./WeeklyChart";

const weeks: WeekStat[] = [
  { week_start: "2026-10-12", count: 0 },
  { week_start: "2026-10-19", count: 1 },
  { week_start: "2026-10-26", count: 2 },
];

describe("WeeklyChart", () => {
  it("labels each week with its count", () => {
    render(<WeeklyChart weeks={weeks} />);
    expect(screen.getByLabelText("Week of Oct 12: 0 applications")).toBeInTheDocument();
    expect(screen.getByLabelText("Week of Oct 19: 1 application")).toBeInTheDocument();
    expect(screen.getByLabelText("Week of Oct 26: 2 applications")).toBeInTheDocument();
  });

  it("scales bars against the busiest week", () => {
    render(<WeeklyChart weeks={weeks} />);
    expect(screen.getByLabelText("Week of Oct 26: 2 applications").firstElementChild).toHaveStyle({ height: "100%" });
    expect(screen.getByLabelText("Week of Oct 19: 1 application").firstElementChild).toHaveStyle({ height: "50%" });
    expect(screen.getByLabelText("Week of Oct 12: 0 applications").firstElementChild).toHaveStyle({ height: "0%" });
  });

  it("renders nothing without data", () => {
    const { container } = render(<WeeklyChart weeks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
