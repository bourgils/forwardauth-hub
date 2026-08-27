let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function updateCsrfToken(value: string | null): void {
  csrfToken = value;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function renewCsrfToken(): Promise<void> {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  const payload = await readPayload(response) as { csrfToken?: string } | null;
  if (payload?.csrfToken) updateCsrfToken(payload.csrfToken);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retryCsrf = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (csrfToken && !["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase())) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const payload = await readPayload(response) as { error?: string; message?: string } | T | null;
  if (!response.ok) {
    const error = payload as { error?: string; message?: string } | null;
    if (response.status === 403 && error?.error === "invalid_csrf_token" && retryCsrf) {
      await renewCsrfToken();
      return apiRequest<T>(path, options, false);
    }
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("coolify-auth:unauthorized"));
    throw new ApiError(response.status, error?.error ?? "request_failed", error?.message ?? `Request failed (${response.status})`);
  }
  return payload as T;
}
