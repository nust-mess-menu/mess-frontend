import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from "node:crypto";

/**
 * Admin session tokens.
 *
 * The cookie value is AES-256-GCM ciphertext of a tiny JSON payload: it is
 * both secret (opaque to the browser) and tamper-proof (GCM authentication
 * fails on any modified byte). It carries no credentials - only "this is an
 * admin session". The backend password stays in server env.
 *
 * Lifetime: 8 hours absolute, and 30 minutes of inactivity. Activity slides
 * the idle window by re-issuing the cookie (see refreshIfStale).
 *
 * Revocation: sign-out records the session id in a bounded in-memory denylist,
 * so a copied cookie stops working on this instance immediately. Rotating
 * SESSION_SECRET revokes every session everywhere.
 */

export const SESSION_TTL_SECONDS = 8 * 60 * 60; // absolute
export const SESSION_IDLE_SECONDS = 30 * 60; // inactivity
const REFRESH_AFTER_SECONDS = 60; // avoid re-issuing on every request
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface SessionPayload {
  sub: "admin";
  sid: string; // random per sign-in
  iat: number; // issued at (seconds)
  exp: number; // absolute expiry (seconds)
  seen: number; // last activity (seconds)
}

function key(secret: string): Buffer {
  // A dedicated derived key, so the raw secret is never used directly
  return Buffer.from(hkdfSync("sha256", secret, "mess-frontend", "admin-session-v1", 32));
}

function encrypt(secret: string, payload: SessionPayload): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(VERSION));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url")}`;
}

export function sealSession(secret: string, now: number = Date.now()): { token: string; payload: SessionPayload } {
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { sub: "admin", sid: randomUUID(), iat, exp: iat + SESSION_TTL_SECONDS, seen: iat };
  return { token: encrypt(secret, payload), payload };
}

/* ---------- Revocation (per instance) ---------- */

const revoked = new Map<string, number>(); // sid -> exp (seconds)
const MAX_REVOKED = 5_000;

export function revokeSession(payload: SessionPayload): void {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [sid, exp] of revoked) if (exp <= nowSec) revoked.delete(sid);
  if (revoked.size >= MAX_REVOKED) {
    const oldest = revoked.keys().next().value;
    if (oldest !== undefined) revoked.delete(oldest);
  }
  revoked.set(payload.sid, payload.exp);
}

/** Returns the payload of a valid, live session, or null. Never throws. */
export function openSession(secret: string, token: string | undefined | null, now: number = Date.now()): SessionPayload | null {
  if (!token || token.length > 512 || !token.startsWith(`${VERSION}.`)) return null;

  try {
    const raw = Buffer.from(token.slice(VERSION.length + 1), "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAAD(Buffer.from(VERSION));
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");

    const p = JSON.parse(json) as Partial<SessionPayload>;
    const nowSec = Math.floor(now / 1000);
    if (
      p.sub !== "admin" ||
      typeof p.sid !== "string" ||
      typeof p.iat !== "number" ||
      typeof p.exp !== "number" ||
      typeof p.seen !== "number" ||
      p.exp <= nowSec || // absolute expiry
      p.exp - p.iat > SESSION_TTL_SECONDS ||
      p.iat > nowSec + 60 || // issued in the future
      p.seen > nowSec + 60 ||
      nowSec - p.seen > SESSION_IDLE_SECONDS || // idle too long
      revoked.has(p.sid)
    ) {
      return null;
    }
    return p as SessionPayload;
  } catch {
    return null;
  }
}

/** A re-issued token with fresh activity time, or null if one isn't due yet. */
export function refreshIfStale(secret: string, payload: SessionPayload, now: number = Date.now()): string | null {
  const nowSec = Math.floor(now / 1000);
  if (nowSec - payload.seen < REFRESH_AFTER_SECONDS) return null;
  return encrypt(secret, { ...payload, seen: nowSec });
}

/**
 * Cookie name. The __Host- prefix makes browsers refuse the cookie unless it
 * is Secure, has Path=/ and no Domain - so no subdomain or plain-http page can
 * set or overwrite it. Browsers require https for it, hence the dev fallback.
 */
export function sessionCookieName(isProduction: boolean): string {
  return isProduction ? "__Host-mess_admin" : "mess_admin";
}

/** Cookie lives until the absolute expiry; idle expiry is enforced server-side. */
export function sessionCookieOptions(isProduction: boolean, maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}
