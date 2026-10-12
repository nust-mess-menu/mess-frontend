import { describe, expect, it } from "vitest";
import {
  openSession,
  refreshIfStale,
  revokeSession,
  sealSession,
  SESSION_IDLE_SECONDS,
  SESSION_TTL_SECONDS,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/server/session";

const SECRET = "s".repeat(48);

describe("admin session tokens", () => {
  it("round-trips and carries no credentials", () => {
    const { token, payload } = sealSession(SECRET);
    expect(openSession(SECRET, token)).toEqual(payload);
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "seen", "sid", "sub"]);
    expect(token).not.toContain("admin");
  });

  it("produces a different ciphertext every time", () => {
    expect(sealSession(SECRET).token).not.toBe(sealSession(SECRET).token);
  });

  it("rejects any tampering", () => {
    const { token } = sealSession(SECRET);
    const raw = Buffer.from(token.slice(3), "base64url");
    for (const index of [0, 15, raw.length - 1]) {
      const copy = Buffer.from(raw);
      copy[index] ^= 0x01;
      expect(openSession(SECRET, `v1.${copy.toString("base64url")}`)).toBeNull();
    }
  });

  it("rejects the wrong secret, expired tokens, junk and oversized input", () => {
    const now = Date.now();
    const { token } = sealSession(SECRET, now);
    expect(openSession("t".repeat(48), token)).toBeNull();
    expect(openSession(SECRET, token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
    for (const junk of [undefined, null, "", "v1.", "v2.abc", "v1.!!!", `v1.${"A".repeat(600)}`]) {
      expect(openSession(SECRET, junk)).toBeNull();
    }
  });

  it("rejects tokens issued in the future (clock tricks)", () => {
    const future = Date.now() + 10 * 60 * 1000;
    const { token } = sealSession(SECRET, future);
    expect(openSession(SECRET, token)).toBeNull();
  });

  it("expires after 30 idle minutes, and activity slides the window", () => {
    const now = Date.now();
    const { token, payload } = sealSession(SECRET, now);
    expect(openSession(SECRET, token, now + (SESSION_IDLE_SECONDS + 1) * 1000)).toBeNull();

    // Active at 20 minutes: refreshed token is valid at 45 minutes
    const at20 = now + 20 * 60 * 1000;
    const refreshed = refreshIfStale(SECRET, payload, at20)!;
    expect(refreshed).toBeTruthy();
    expect(openSession(SECRET, refreshed, now + 45 * 60 * 1000)).not.toBeNull();
    // ...but never beyond the absolute lifetime
    expect(openSession(SECRET, refreshed, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
    // No churn: a fresh session is not re-issued on every request
    expect(refreshIfStale(SECRET, payload, now + 5_000)).toBeNull();
  });

  it("a signed-out session cannot be replayed", () => {
    const { token, payload } = sealSession(SECRET);
    expect(openSession(SECRET, token)).not.toBeNull();
    revokeSession(payload);
    expect(openSession(SECRET, token)).toBeNull();
  });

  it("uses a __Host- HttpOnly SameSite=Strict cookie in production", () => {
    expect(sessionCookieName(true)).toBe("__Host-mess_admin");
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  });
});
