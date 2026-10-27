import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PipelineStat } from "../../api/types";
import { FunnelBranches } from "./FunnelBranches";

const pipeline: PipelineStat[] = [
  { status: "applied", label: "Applied", count: 3 },
  { status: "phone_screen", label: "Phone Screen", count: 1 },
  { status: "interview", label: "Interview", count: 1 },
  { status: "offer", label: "Offer", count: 1 },
  { status: "rejected", label: "Rejected", count: 3 },
  { status: "withdrawn", label: "Withdrawn", count: 1 },
];

describe("FunnelBranches", () => {
  it("shows only the rejected and withdrawn branches with their share of the total", () => {
    render(<FunnelBranches pipeline={pipeline} total={41} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Rejected: 3 (7.3%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Withdrawn: 1 (2.4%)")).toBeInTheDocument();
  });

  it("sizes each bar by its percentage", () => {
    render(<FunnelBranches pipeline={pipeline} total={41} />);
    expect(screen.getByTestId("branch-bar-rejected")).toHaveStyle({ width: "7.3%" });
    expect(screen.getByTestId("branch-bar-withdrawn")).toHaveStyle({ width: "2.4%" });
  });
});
