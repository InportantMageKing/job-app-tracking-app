import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ApplicationDetailPage } from "./ApplicationDetailPage";

const useApplication = vi.fn((_id: number, _options?: { enabled?: boolean }) => ({
  isPending: true,
  isError: false,
  data: undefined,
  error: null,
}));
const mutation = { mutateAsync: vi.fn(), isPending: false };

vi.mock("../api/applications", () => ({
  useApplication: (id: number, options?: { enabled?: boolean }) => useApplication(id, options),
  useUpdateApplication: () => mutation,
  useAddEvent: () => mutation,
  useDeleteApplication: () => mutation,
  toApplicationInput: vi.fn(),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationDetailPage", () => {
  it("shows not found for a non-numeric id without sending a request", () => {
    renderAt("/applications/abc");
    expect(screen.getByRole("alert")).toHaveTextContent("This application doesn't exist.");
    expect(useApplication).toHaveBeenCalledWith(Number.NaN, { enabled: false });
  });

  it("loads a numeric id", () => {
    renderAt("/applications/12");
    expect(useApplication).toHaveBeenLastCalledWith(12, { enabled: true });
  });
});
