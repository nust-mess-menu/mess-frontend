import { describe, expect, it } from "vitest";
import { adminCsp, siteCsp } from "@/lib/csp";
import { checkAdminCredentials, safeEqual } from "@/lib/server/credentials";
import { loadServerEnv, ServerConfigError } from "@/lib/server/env";
import { AttemptLimiter, clientIp, requestHost } from "@/lib/server/rateLimit";
import { ENV } from "./env";

describe("credentials", () => {
  it("compares in constant time over digests", () => {
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "ab")).toBe(false);
    const expected = { username: "u", password: "p:w" };
    expect(checkAdminCredentials("u", "p:w", expected)).toBe(true);
    expect(checkAdminCredentials("u", "p", expected)).toBe(false);
    expect(checkAdminCredentials("U", "p:w", expected)).toBe(false);
  });
});

describe("AttemptLimiter", () => {
  it("locks after N attempts and unlocks after the window", () => {
    const limiter = new AttemptLimiter(3, 1000);
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.record("ip", t);
    expect(limiter.lockedFor("ip", t)).toBeGreaterThan(0);
    expect(limiter.lockedFor("other", t)).toBe(0);
    expect(limiter.lockedFor("ip", t + 1001)).toBe(0);
  });

  it("reset clears the count", () => {
    const limiter = new AttemptLimiter(1, 1000);
    limiter.record("ip");
    limiter.reset("ip");
    expect(limiter.lockedFor("ip")).toBe(0);
  });
});

describe("clientIp / requestHost", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("trusts exactly the configured hops from the right", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }), 1)).toBe("1.2.3.4");
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4, 10.0.0.1" }), 2)).toBe("1.2.3.4");
  });

  it("returns null when no IP can be trusted (never a shared, lockable bucket)", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6" }), 0)).toBeNull();
    expect(clientIp(h({}), 1)).toBeNull();
    expect(clientIp(h({ "x-real-ip": "1.2.3.4" }), 1)).toBeNull();
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4" }), 2)).toBeNull(); // fewer entries than hops
    expect(clientIp(h({ "x-forwarded-for": "not-an-ip<script>" }), 1)).toBeNull();
  });

  it("uses X-Forwarded-Host only behind trusted proxies", () => {
    expect(requestHost(h({ host: "internal:3000", "x-forwarded-host": "admin.example.edu" }), 1)).toBe("admin.example.edu");
    expect(requestHost(h({ host: "mess.example.edu", "x-forwarded-host": "admin.example.edu" }), 0)).toBe("mess.example.edu");
  });
});

describe("server env", () => {
  const problems = (env: Record<string, string | undefined>) => {
    try {
      loadServerEnv(env);
      return "";
    } catch (e) {
      return (e as ServerConfigError).problems.join("\n");
    }
  };

  it("accepts a complete production config", () => {
    expect(loadServerEnv(ENV).adminOrigin).toBe("https://mess.example.edu");
  });

  it("refuses weak, missing and non-https values in production", () => {
    const p = problems({ ...ENV, ADMIN_PASSWORD: "short", SESSION_SECRET: "tiny", ADMIN_URL: "http://mess.example.edu", BACKEND_ADMIN_USERNAME: undefined, TRUSTED_PROXY_HOPS: undefined });
    expect(p).toContain("ADMIN_PASSWORD must be at least 16");
    expect(p).toContain("SESSION_SECRET must be at least 32");
    expect(p).toContain("ADMIN_URL must use https");
    expect(p).toContain("BACKEND_ADMIN_USERNAME is required");
    expect(p).toContain("TRUSTED_PROXY_HOPS is required in production");
  });

  it("rejects long but low-entropy passwords", () => {
    expect(problems({ ...ENV, ADMIN_PASSWORD: "a".repeat(20) })).toContain("too repetitive");
  });

  it("detects a split admin/site deployment", () => {
    const split = loadServerEnv({ ...ENV, ADMIN_URL: "https://admin.example.edu", SITE_URL: "https://mess.example.edu" });
    expect(split.adminHost).toBe("admin.example.edu");
    expect(split.siteHost).toBe("mess.example.edu");
    expect(loadServerEnv(ENV).siteHost).toBeNull();
  });

  it("allows http only for loopback hosts", () => {
    expect(problems({ ...ENV, ADMIN_URL: "http://localhost:3000", BACKEND_URL: "http://127.0.0.1:8080" })).toBe("");
  });

  it("rejects origins with paths or credentials", () => {
    expect(problems({ ...ENV, BACKEND_URL: "https://user:pw@api.example.edu/x" })).toContain("bare origin");
  });

  it("never echoes secret values", () => {
    const secret = "leaky-secret-value";
    expect(problems({ ...ENV, ADMIN_PASSWORD: secret })).not.toContain(secret);
  });
});

describe("CSP", () => {
  const base = { nonce: "abc", isDev: false, upgradeInsecure: true };
  it("site: nonce + strict-dynamic, no inline/eval scripts, no framing", () => {
    const csp = siteCsp({ ...base, apiOrigin: "https://api.example.edu", firebaseAuthDomain: "x.firebaseapp.com", userbackEnabled: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("connect-src 'self' https://api.example.edu");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("userback");
  });

  it("admin: no third-party origins anywhere", () => {
    const csp = adminCsp(base);
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src 'none'");
  });
});
