"use client";

/**
 * Client for this app's own admin API (/api/admin/*). Same-origin only; the
 * HttpOnly session cookie travels automatically and is invisible to scripts.
 */

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message: string;
}

export async function adminFetch<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; query?: Record<string, string> } = {}
): Promise<ApiResult<T>> {
  const url = new URL(`/api/admin/${path}`, window.location.origin);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null, message: "Network error. Check your connection and try again." };
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401) {
    // Session expired or revoked: a full navigation discards all in-memory
    // admin state before showing the sign-in page
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin/login?expired=1");
  }

  const body = (data ?? {}) as { message?: unknown; error?: unknown };
  const message =
    typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : response.ok ? "" : "Request failed";

  return { ok: response.ok, status: response.status, data: data as T, message };
}
