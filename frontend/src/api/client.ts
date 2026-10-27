/** The single place the app talks HTTP: adds the token, prefixes /api, and normalizes errors. */

const TOKEN_KEY = "jobtracker.token";
const USERNAME_KEY = "jobtracker.username";

/** Flatten DRF error bodies ({"field": ["msg"]} or {"detail": "msg"}) into one readable line. */
export function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const parts = Object.entries(body as Record<string, unknown>).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    return key === "detail" || key === "non_field_errors" ? text : `${key}: ${text}`;
  });
  return parts.length > 0 ? parts.join(" ") : null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(errorMessage(body) ?? `Request failed (${status}).`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  getUsername: () => localStorage.getItem(USERNAME_KEY),
  set: (token: string, username: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
};

let onUnauthorized: () => void = () => {};

/** Register what happens when the API rejects the stored token (AuthProvider logs the user out). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Token ${token}`);
  // FormData bodies must keep the browser-generated multipart Content-Type.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (response.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }
  return response;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Download a protected file. A plain link can't send the token header, so fetch it as a blob. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await send(path);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function jsonBody(data: unknown): string {
  return JSON.stringify(data);
}
