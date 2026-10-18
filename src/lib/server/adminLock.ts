import "server-only";
import { NextResponse } from "next/server";
import { callBackend } from "./admin";

/**
 * The admin sign-in lock, kept by mess-backend in Firestore so every instance
 * of this app sees the same state. More than 5 wrong passwords in 24 hours
 * lock sign-in for 24 hours, even with the right password. It lifts after 24
 * hours, by deleting config/admin-lock in the Firebase console, or with
 * `npm run admin:unlock` in mess-backend.
 */

export interface AdminLockState {
  locked: boolean;
  lockedUntil: string | null;
  remaining: number | null;
}

function parse(data: unknown): AdminLockState {
  const d = (data ?? {}) as Record<string, unknown>;
  const lockedUntil = typeof d.lockedUntil === "string" && !Number.isNaN(Date.parse(d.lockedUntil)) ? d.lockedUntil : null;
  return {
    locked: d.locked === true && lockedUntil !== null,
    lockedUntil,
    remaining: typeof d.remaining === "number" ? d.remaining : null,
  };
}

/** Current state, or null when the backend can't be reached (callers fail closed). */
export async function getAdminLock(): Promise<AdminLockState | null> {
  const response = await callBackend("GET", "/api/admin/lock");
  return response.ok ? parse(await response.json()) : null;
}

/** Record a sign-in attempt; returns the new state, or null when the backend can't be reached. */
export async function reportSignIn(result: "success" | "failure"): Promise<AdminLockState | null> {
  const response = await callBackend("POST", "/api/admin/lock", { body: { result } });
  return response.ok ? parse(await response.json()) : null;
}

const fmtUnlock = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function lockMessage(lockedUntil: string): string {
  return (
    `Admin sign-in is locked for 24 hours after too many wrong passwords. It unlocks on ${fmtUnlock(lockedUntil)} (Pakistan time). ` +
    "To unlock sooner, delete config/admin-lock in the Firebase console, or run `npm run admin:unlock` in mess-backend."
  );
}

/** 423 Locked, with the unlock time for the sign-in page. */
export function lockedResponse(lockedUntil: string): NextResponse {
  const message = lockMessage(lockedUntil);
  const retryAfter = Math.max(1, Math.ceil((Date.parse(lockedUntil) - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: message, message, code: "admin_locked", lockedUntil },
    { status: 423, headers: { "Retry-After": String(retryAfter) } }
  );
}
