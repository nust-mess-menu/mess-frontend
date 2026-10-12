import { publicEnv } from "@/lib/publicEnv";

/** Absolute URL on mess-backend. Paths are always constants from this codebase. */
export function apiUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, publicEnv.apiBaseUrl);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Read an error message from a backend error body, if there is one. */
export async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    const msg = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : null;
    return msg && msg.length < 300 ? msg : fallback;
  } catch {
    return fallback;
  }
}
