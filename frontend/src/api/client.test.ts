import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, errorMessage, setUnauthorizedHandler, tokenStore } from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(() => {});
});

describe("apiFetch", () => {
  it("prefixes /api, sends the stored token, and sends JSON", async () => {
    tokenStore.set("abc123", "atlas");
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(apiFetch("/applications/", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/applications/");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Token abc123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("sends no Authorization header when logged out", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiFetch("/applications/");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch("/auth/logout/", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws ApiError with a readable message for validation errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { company: ["This field is required."] }));
    const error = (await apiFetch("/applications/").catch((caught) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("company: This field is required.");
  });

  it("clears the session and calls the unauthorized handler on 401", async () => {
    tokenStore.set("expired", "atlas");
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Invalid token." }));

    await expect(apiFetch("/applications/")).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("errorMessage", () => {
  it("shows detail and non-field errors without a field prefix", () => {
    expect(errorMessage({ detail: "Not found." })).toBe("Not found.");
    expect(errorMessage({ non_field_errors: ["Invalid username or password."] })).toBe(
      "Invalid username or password.",
    );
  });

  it("returns null for bodies it can't read", () => {
    expect(errorMessage(null)).toBeNull();
    expect(errorMessage("oops")).toBeNull();
  });
});
