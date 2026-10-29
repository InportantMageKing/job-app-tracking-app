import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows the readable label for a status", () => {
    render(<StatusBadge status="phone_screen" />);
    expect(screen.getByText("Phone Screen")).toBeInTheDocument();
  });

  it("marks each status with its own line color", () => {
    render(
      <>
        <StatusBadge status="offer" />
        <StatusBadge status="rejected" />
      </>,
    );
    expect(screen.getByText("Offer").querySelector("[data-line]")).toHaveClass("bg-line-offer");
    expect(screen.getByText("Rejected").querySelector("[data-line]")).toHaveClass("bg-line-rejected");
  });
});
