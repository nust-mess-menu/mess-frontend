import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSameOrigin, isAdminHost, jsonError, readJsonBody, readSession } from "@/lib/server/admin";
import { getAdminLock, lockedResponse, reportSignIn } from "@/lib/server/adminLock";
import { checkAdminCredentials } from "@/lib/server/credentials";
import { serverEnv } from "@/lib/server/env";
import { clientIp, failureDelayMs, globalFailures, loginLimiter } from "@/lib/server/rateLimit";
import {
  revokeSession,
  sealSession,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/server/session";

const loginBody = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

// Bounds guessing throughput even when no trustworthy client IP is available
const MAX_IN_FLIGHT = 8;
let inFlight = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const unavailable = () =>
  jsonError(503, "Sign-in is unavailable right now: the menu server could not be reached. Please try again.", "lock_unavailable");

/** GET /api/admin/session - is there a valid admin session? */
export async function GET(request: NextRequest) {
  if (!isAdminHost(request)) return jsonError(404, "Not found", "not_found");
  const session = readSession(request);
  return NextResponse.json({
    authenticated: Boolean(session),
    expiresAt: session ? new Date(session.exp * 1000).toISOString() : null,
  });
}

/** POST /api/admin/session { username, password } - sign in */
export async function POST(request: NextRequest) {
  if (!isAdminHost(request)) return jsonError(404, "Not found", "not_found");
  const originError = checkSameOrigin(request);
  if (originError) return originError;

  const env = serverEnv();
  const ip = clientIp(request.headers, env.trustedProxyHops);

  // Check and reserve synchronously - no await in between - so a burst of
  // parallel attempts cannot all pass the check before any is counted
  if (ip) {
    const lockedFor = loginLimiter.lockedFor(ip);
    if (lockedFor > 0) {
      return jsonError(429, `Too many sign-in attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
        "rate_limited", { "Retry-After": String(lockedFor) });
    }
    loginLimiter.record(ip);
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    return jsonError(429, "Too many sign-in attempts right now. Try again shortly.", "rate_limited", { "Retry-After": "5" });
  }

  inFlight += 1;
  try {
    const parsed = await readJsonBody(request, 4 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = loginBody.safeParse(parsed.body);

    // The 24-hour lock (shared by every instance, kept by the backend) is
    // checked before the password, so a locked console refuses even the right
    // one. Fails closed: if the lock can't be read, nobody signs in.
    const lock = await getAdminLock();
    if (!lock) return unavailable();
    if (lock.locked) return lockedResponse(lock.lockedUntil!);

    const valid =
      body.success &&
      checkAdminCredentials(body.data.username, body.data.password, {
        username: env.adminUsername,
        password: env.adminPassword,
      });

    if (!valid) {
      globalFailures.record("all");
      console.warn("[admin] failed sign-in", { ip: ip ?? "unknown" });
      const after = await reportSignIn("failure");
      // Held while in flight, so the delay also limits parallel guessing
      await sleep(failureDelayMs());
      if (after?.locked) return lockedResponse(after.lockedUntil!);
      // `remaining` wrong passwords are still allowed; the one after them locks
      const toLock = after?.remaining != null ? after.remaining + 1 : null;
      const left = toLock ? ` ${toLock} more wrong attempt${toLock === 1 ? "" : "s"} will lock sign-in for 24 hours.` : "";
      return jsonError(401, `Incorrect username or password.${left}`, "invalid_credentials");
    }

    // Clears the failure count; refuses if a lock landed in the meantime
    const after = await reportSignIn("success");
    if (!after) return unavailable();
    if (after.locked) return lockedResponse(after.lockedUntil!);

    if (ip) loginLimiter.reset(ip);
    const { token, payload } = sealSession(env.sessionSecret);
    console.info("[admin] signed in", { ip: ip ?? "unknown", sid: payload.sid });

    const response = NextResponse.json({ authenticated: true, expiresAt: new Date(payload.exp * 1000).toISOString() });
    response.cookies.set(sessionCookieName(env.isProduction), token, sessionCookieOptions(env.isProduction));
    return response;
  } finally {
    inFlight -= 1;
  }
}

/** DELETE /api/admin/session - sign out (and revoke this session server-side) */
export async function DELETE(request: NextRequest) {
  if (!isAdminHost(request)) return jsonError(404, "Not found", "not_found");
  const originError = checkSameOrigin(request);
  if (originError) return originError;

  const env = serverEnv();
  const session = readSession(request);
  if (session) revokeSession(session);

  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookieName(env.isProduction), "", sessionCookieOptions(env.isProduction, 0));
  // Drop cached admin responses. Not "storage": the student side of this same
  // origin (when not split onto its own host) keeps its session in localStorage.
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}
