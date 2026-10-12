import "server-only";

/**
 * Sign-in throttling, in memory.
 *
 * - Per client IP (when the IP is trustworthy): 5 attempts per 15 minutes.
 *   Attempts are reserved *before* any await in the handler, so a burst of
 *   parallel requests cannot all slip past the check.
 * - Globally (all clients): a slowdown, never a lock. Once failures pile up
 *   from anywhere, every failed attempt is delayed longer. A global hard lock
 *   would let an attacker lock the real admin out at will.
 *
 * Maps are bounded so a flood of distinct keys cannot grow memory. Per
 * instance: on serverless each instance counts separately; the long random
 * password requirement is the real defence against guessing.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 10_000;

export class AttemptLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    readonly maxAttempts: number,
    readonly windowMs: number
  ) {}

  private live(key: string, now: number): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && now >= entry.resetAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Seconds until the key may try again, or 0 if it may try now. */
  lockedFor(key: string, now: number = Date.now()): number {
    const entry = this.live(key, now);
    return entry && entry.count >= this.maxAttempts ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  /** Count an attempt. Synchronous, so it cannot race with a concurrent check. */
  record(key: string, now: number = Date.now()): number {
    let entry = this.live(key, now);
    if (!entry) {
      if (this.entries.size >= MAX_KEYS) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count;
  }

  count(key: string, now: number = Date.now()): number {
    return this.live(key, now)?.count ?? 0;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}

const WINDOW_MS = 15 * 60 * 1000;

// Per trustworthy client IP
export const loginLimiter = new AttemptLimiter(5, WINDOW_MS);
// All failures, any client - drives the slowdown only
export const globalFailures = new AttemptLimiter(Number.MAX_SAFE_INTEGER, WINDOW_MS);

/** Delay applied to a failed sign-in: grows with recent failures site-wide. */
export function failureDelayMs(now: number = Date.now()): number {
  const recent = globalFailures.count("all", now);
  if (recent > 100) return 5_000;
  if (recent > 25) return 2_000;
  return 600;
}

/**
 * Client IP from X-Forwarded-For, trusting exactly the configured number of
 * proxy hops counted from the right (the end proxies append to).
 *
 * Returns null when no trustworthy IP exists: zero trusted hops, a missing
 * header, or fewer entries than hops (the request did not come through the
 * expected proxies). Callers then skip per-IP locking rather than lumping
 * everyone into one bucket an attacker could lock.
 */
export function clientIp(headers: Headers, trustedHops: number): string | null {
  if (trustedHops <= 0) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length < trustedHops) return null;
  const candidate = hops[hops.length - trustedHops];
  return candidate && candidate.length <= 64 && /^[0-9a-fA-F.:]+$/.test(candidate) ? candidate : null;
}

/**
 * The host the client asked for. Behind trusted proxies, X-Forwarded-Host
 * (rightmost trusted entry) carries the public host; otherwise Host.
 */
export function requestHost(headers: Headers, trustedHops: number): string | null {
  if (trustedHops > 0) {
    const forwarded = headers.get("x-forwarded-host");
    if (forwarded) {
      const hosts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      const candidate = hosts[Math.max(0, hosts.length - trustedHops)];
      if (candidate) return candidate.toLowerCase();
    }
  }
  return headers.get("host")?.toLowerCase() ?? null;
}
