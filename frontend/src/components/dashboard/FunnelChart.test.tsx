import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StageStat } from "../../api/types";
import { FunnelChart } from "./FunnelChart";

const stages: StageStat[] = [
  { stage: "applied", label: "Applied", count: 4, percent: 100 },
  { stage: "phone_screen", label: "Phone Screen", count: 3, percent: 75 },
  { stage: "interview", label: "Interview", count: 2, percent: 50 },
  { stage: "offer", label: "Offer", count: 1, percent: 25 },
];

describe("FunnelChart", () => {
  it("labels every stage with its count and share", () => {
    render(<FunnelChart stages={stages} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("Interview: 2 (50%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Offer: 1 (25%)")).toBeInTheDocument();
  });

  it("sizes each bar by its percentage", () => {
    render(<FunnelChart stages={stages} />);
    expect(screen.getByTestId("funnel-bar-applied")).toHaveStyle({ width: "100%" });
    expect(screen.getByTestId("funnel-bar-phone_screen")).toHaveStyle({ width: "75%" });
  });
});
