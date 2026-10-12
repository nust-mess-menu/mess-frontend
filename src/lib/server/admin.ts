import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv, type ServerEnv } from "./env";
import { requestHost } from "./rateLimit";
import { openSession, refreshIfStale, sessionCookieName, sessionCookieOptions, type SessionPayload } from "./session";

/**
 * Admin backend-for-frontend helpers.
 *
 * The browser talks only to this app's /api/admin/* routes, authenticated by
 * the encrypted HttpOnly session cookie. Those routes call mess-backend with
 * server-held admin credentials, so the admin's browser never holds a backend
 * credential that XSS, an extension or a shared machine could steal.
 *
 * Isolation: admin pages and APIs answer only on the ADMIN_URL host. Serving the
 * admin from its own subdomain (e.g. admin.example.edu) therefore keeps every
 * script on the student site - including third-party widgets - out of the
 * admin API entirely: they run on a different origin, the __Host- cookie is
 * not sent there, and the Origin check refuses them.
 */

const MAX_BODY_BYTES = 100 * 1024;
const BACKEND_TIMEOUT_MS = 20_000;

export function jsonError(status: number, message: string, code: string, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, error: message, message, code }, { status, headers });
}

/** True when the request targets the configured admin host. */
export function isAdminHost(request: NextRequest, env: ServerEnv = serverEnv()): boolean {
  return requestHost(request.headers, env.trustedProxyHops) === env.adminHost;
}

export function readSession(request: NextRequest): SessionPayload | null {
  const env = serverEnv();
  return openSession(env.sessionSecret, request.cookies.get(sessionCookieName(env.isProduction))?.value);
}

/**
 * Cross-site request forgery defence for state-changing requests, on top of
 * the SameSite=Strict cookie: the request must declare the admin origin and,
 * where the browser reports it, come from that same origin.
 */
export function checkSameOrigin(request: NextRequest): NextResponse | null {
  const env = serverEnv();
  if (request.headers.get("origin") !== env.adminOrigin) {
    return jsonError(403, "Cross-origin request refused", "origin_not_allowed");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return jsonError(403, "Cross-site request refused", "origin_not_allowed");
  }
  return null;
}

/**
 * Wrap an admin API handler: host binding, CSRF check for mutations, session
 * verification, and sliding refresh of the idle timeout on success.
 */
export async function adminRoute(
  request: NextRequest,
  options: { mutation: boolean },
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const env = serverEnv();
  if (!isAdminHost(request, env)) return jsonError(404, "Not found", "not_found");
  if (options.mutation) {
    const originError = checkSameOrigin(request);
    if (originError) return originError;
  }

  const session = readSession(request);
  if (!session) {
    return jsonError(401, "Your admin session has expired. Please sign in again.", "session_expired");
  }

  const response = await handler();

  const refreshed = refreshIfStale(env.sessionSecret, session);
  if (refreshed) {
    const remaining = session.exp - Math.floor(Date.now() / 1000);
    response.cookies.set(sessionCookieName(env.isProduction), refreshed, sessionCookieOptions(env.isProduction, remaining));
  }
  return response;
}

/**
 * Read a JSON request body with a hard size cap. Content-Length is not
 * trusted on its own - the stream is measured as it is read.
 */
export async function readJsonBody(
  request: NextRequest,
  limit: number = MAX_BODY_BYTES
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) {
    return { ok: false, response: jsonError(415, "Content-Type must be application/json", "unsupported_media_type") };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) {
    return { ok: false, response: jsonError(413, "Request body too large", "payload_too_large") };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, response: jsonError(400, "Request body is required", "bad_request") };

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return { ok: false, response: jsonError(413, "Request body too large", "payload_too_large") };
    }
    chunks.push(value);
  }

  try {
    return { ok: true, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON in request body", "invalid_json") };
  }
}

/**
 * Call mess-backend with the server's admin credentials and relay the result.
 *
 * - Redirects are refused, so credentials can never be replayed to another host.
 * - Backend auth failures become a 502: they mean this server is misconfigured,
 *   and the admin must not learn anything about the backend credentials.
 * - 5xx and network errors are reduced to generic messages.
 * - 4xx bodies are reduced to their human-readable message.
 */
export async function callBackend(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {}
): Promise<NextResponse> {
  const env = serverEnv();
  const url = new URL(path, env.backendUrl);
  // Defence in depth: paths are constants in this codebase, but never send
  // credentials anywhere except the configured backend
  if (url.origin !== env.backendUrl) {
    return jsonError(500, "Invalid backend path", "internal_error");
  }
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);

  const credentials = Buffer.from(`${env.backendAdminUsername}:${env.backendAdminPassword}`, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[admin-bff] backend unreachable", { path, error: (error as Error)?.name });
    return jsonError(502, "The menu server could not be reached. Please try again.", "backend_unreachable");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401 || response.status === 403) {
    console.error("[admin-bff] backend rejected server credentials", { path, status: response.status });
    return jsonError(502, "The menu server rejected this app's credentials. Check the server configuration.", "backend_auth_failed");
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return jsonError(429, "Too many requests to the menu server. Please wait a moment.", "rate_limited",
      retryAfter && /^\d{1,6}$/.test(retryAfter) ? { "Retry-After": retryAfter } : undefined);
  }
  if (response.status >= 500) {
    console.error("[admin-bff] backend error", { path, status: response.status });
    return jsonError(502, "The menu server hit an error. Please try again.", "backend_error");
  }
  if (response.status >= 400) {
    // Validation messages are written for humans; pass only those along
    const body = (data ?? {}) as { message?: unknown; code?: unknown };
    const message = typeof body.message === "string" && body.message.length <= 300 ? body.message : "Request rejected";
    const code = typeof body.code === "string" && /^[a-z_/.-]{1,40}$/i.test(body.code) ? body.code : "bad_request";
    return jsonError(response.status, message, code);
  }

  return NextResponse.json(data ?? {}, { status: response.status });
}
