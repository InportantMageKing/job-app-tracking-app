import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows the readable label for a status", () => {
    render(<StatusBadge status="phone_screen" />);
    expect(screen.getByText("Phone Screen")).toBeInTheDocument();
  });

  it("colors an offer differently from a rejection", () => {
    render(
      <>
        <StatusBadge status="offer" />
        <StatusBadge status="rejected" />
      </>,
    );
    expect(screen.getByText("Offer")).toHaveClass("bg-emerald-500/15");
    expect(screen.getByText("Rejected")).toHaveClass("bg-rose-500/15");
  });
});
