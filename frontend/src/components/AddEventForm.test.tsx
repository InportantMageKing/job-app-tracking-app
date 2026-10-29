import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NewEvent, Status } from "../api/types";
import { AddEventForm } from "./AddEventForm";

function setup(currentStatus: Status = "applied", onSubmit = vi.fn<(event: NewEvent) => Promise<unknown>>()) {
  onSubmit.mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<AddEventForm currentStatus={currentStatus} onSubmit={onSubmit} />);
  return { user, onSubmit };
}

describe("AddEventForm", () => {
  it("blocks an empty note", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write a note before saving.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a trimmed note and clears the field", async () => {
    const { user, onSubmit } = setup();
    const noteBox = screen.getByLabelText("Note");
    await user.type(noteBox, "  Recruiter emailed  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ event_type: "note", note: "Recruiter emailed" });
    expect(noteBox).toHaveValue("");
  });

  it("requires a new status in status mode", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Change status" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick the new status.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not offer the status the application is already in", async () => {
    const { user } = setup("interview");
    await user.click(screen.getByRole("button", { name: "Change status" }));
    const options = within(screen.getByLabelText("New status"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).not.toContain("Interview");
    expect(options).toContain("Offer");
    expect(options).toContain("Rejected");
  });

  it("submits a status change with an optional note", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Change status" }));
    await user.selectOptions(screen.getByLabelText("New status"), "phone_screen");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ event_type: "status_change", to_status: "phone_screen", note: "" });
  });

  it("shows the server's error message when saving fails", async () => {
    const onSubmit = vi.fn<(event: NewEvent) => Promise<unknown>>();
    const { user } = setup("applied", onSubmit);
    onSubmit.mockRejectedValue(new Error("Application is already in status 'applied'."));
    await user.type(screen.getByLabelText("Note"), "Follow-up sent");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already in status");
  });
});
