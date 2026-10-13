import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sealSession } from "@/lib/server/session";
import { globalFailures, loginLimiter } from "@/lib/server/rateLimit";
import { ENV, useEnv } from "./env";

const APP = ENV.ADMIN_URL;
const COOKIE = "__Host-mess_admin";

function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; session?: boolean; rawBody?: string } = {}) {
  const headers = new Headers({ host: "mess.example.edu", ...init.headers });
  if (init.session) headers.set("cookie", `${COOKIE}=${sealSession(ENV.SESSION_SECRET).token}`);
  const body = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  if (body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new NextRequest(new URL(path, APP), { method: init.method ?? "GET", headers, body });
}

const sameOrigin = { origin: APP };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  useEnv();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  loginLimiter.reset("1.2.3.4");
  loginLimiter.reset("9.9.9.9");
  globalFailures.reset("all");
});

describe("POST /api/admin/session (sign in)", () => {
  const login = async (body: unknown, headers: Record<string, string> = { ...sameOrigin, "x-forwarded-for": "1.2.3.4" }) => {
    const { POST } = await import("@/app/api/admin/session/route");
    return POST(req("/api/admin/session", { method: "POST", body, headers }));
  };

  it("sets a hardened session cookie on success and never calls the backend", async () => {
    const res = await login({ username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^__Host-mess_admin=v1\./);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects wrong credentials, then locks out the IP after 5 failures", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login({ username: ENV.ADMIN_USERNAME, password: "wrong" })).status).toBe(401);
    }
    const locked = await login({ username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    // A different client is unaffected
    const other = await login({ username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD }, { ...sameOrigin, "x-forwarded-for": "9.9.9.9" });
    expect(other.status).toBe(200);
  }, 20_000);

  it("refuses cross-origin and origin-less sign-in (login CSRF)", async () => {
    const good = { username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD };
    expect((await login(good, { origin: "https://evil.example.com" })).status).toBe(403);
    expect((await login(good, {})).status).toBe(403);
  });

  it("does not accept the backend's credentials as an admin login", async () => {
    const res = await login({ username: ENV.BACKEND_ADMIN_USERNAME, password: ENV.BACKEND_ADMIN_PASSWORD });
    expect(res.status).toBe(401);
  });

  it("rejects non-JSON and malformed bodies", async () => {
    const { POST } = await import("@/app/api/admin/session/route");
    const text = await POST(req("/api/admin/session", { method: "POST", rawBody: "u=a", headers: { ...sameOrigin, "content-type": "application/x-www-form-urlencoded" } }));
    expect(text.status).toBe(415);
    const bad = await POST(req("/api/admin/session", { method: "POST", rawBody: "{", headers: sameOrigin }));
    expect(bad.status).toBe(400);
  });

  it("counts parallel attempts: a burst cannot exceed the per-IP budget", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => login({ username: ENV.ADMIN_USERNAME, password: "wrong" }))
    );
    const statuses = attempts.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(3);
  }, 20_000);

  it("sign out expires the cookie and revokes the session server-side", async () => {
    const { DELETE } = await import("@/app/api/admin/session/route");
    const { GET } = await import("@/app/api/admin/week/route");
    const token = sealSession(ENV.SESSION_SECRET).token;
    const cookie = { cookie: `${COOKIE}=${token}` };
    expect((await GET(req("/api/admin/week", { headers: cookie }))).status).toBe(200);
    const res = await DELETE(req("/api/admin/session", { method: "DELETE", headers: { ...sameOrigin, ...cookie } }));
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(res.headers.get("clear-site-data")).toBe('"cache"');
    // A copy of the cookie taken before sign-out no longer works
    expect((await GET(req("/api/admin/week", { headers: cookie }))).status).toBe(401);
  });
});

describe("admin BFF routes", () => {
  it("answer only on the admin host", async () => {
    const { GET } = await import("@/app/api/admin/week/route");
    const res = await GET(req("/api/admin/week", { session: true, headers: { host: "evil.example.com" } }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("are isolated from the student host in a split deployment", async () => {
    useEnv({ ADMIN_URL: "https://admin.example.edu", SITE_URL: "https://mess.example.edu" });
    const { POST } = await import("@/app/api/admin/week/route");
    // A script on the student site, with the admin's cookie somehow present
    const res = await POST(req("/api/admin/week", { method: "POST", session: true, headers: { host: "mess.example.edu", origin: "https://mess.example.edu" } }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("slide the idle timeout by re-issuing the cookie when due", async () => {
    const { GET } = await import("@/app/api/admin/week/route");
    const stale = sealSession(ENV.SESSION_SECRET, Date.now() - 5 * 60 * 1000).token;
    const res = await GET(req("/api/admin/week", { headers: { cookie: `${COOKIE}=${stale}` } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^__Host-mess_admin=v1\./);
  });

  it("require a valid session", async () => {
    const { GET } = await import("@/app/api/admin/menu/route");
    expect((await GET(req("/api/admin/menu"))).status).toBe(401);
    const forged = req("/api/admin/menu", { headers: { cookie: `${COOKIE}=v1.forged` } });
    expect((await GET(forged)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("require same-origin for every mutation", async () => {
    const { POST } = await import("@/app/api/admin/week/route");
    const res = await POST(req("/api/admin/week", { method: "POST", session: true }));
    expect(res.status).toBe(403);
    const crossSite = await POST(req("/api/admin/week", { method: "POST", session: true, headers: { ...sameOrigin, "sec-fetch-site": "cross-site" } }));
    expect(crossSite.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards to the backend with server credentials, no redirects, only allowed fields", async () => {
    const { POST } = await import("@/app/api/admin/menu/route");
    const res = await POST(
      req("/api/admin/menu", {
        method: "POST",
        session: true,
        headers: sameOrigin,
        body: { weekNumber: 1, day: "monday", mealType: "lunch", dishes: ["Daal"], isAdmin: true, __proto__: { x: 1 } },
      })
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://api.example.edu/api/admin/menu");
    expect(init.redirect).toBe("manual");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(Buffer.from(auth.replace("Basic ", ""), "base64").toString()).toBe(`${ENV.BACKEND_ADMIN_USERNAME}:${ENV.BACKEND_ADMIN_PASSWORD}`);
    expect(JSON.parse(String(init.body))).toEqual({ weekNumber: 1, day: "monday", mealType: "lunch", dishes: ["Daal"] });
  });

  it("refuses backend redirects (credentials never follow them)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://evil.example/" } }));
    const { GET } = await import("@/app/api/admin/stats/route");
    const res = await GET(req("/api/admin/stats", { session: true }));
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates input before it reaches the backend", async () => {
    const { POST, DELETE } = await import("@/app/api/admin/menu/route");
    for (const body of [
      { weekNumber: 3, day: "monday", mealType: "lunch", dishes: ["x"] },
      { weekNumber: 1, day: "someday", mealType: "lunch", dishes: ["x"] },
      { weekNumber: 1, day: "monday", mealType: "lunch", dishes: Array(21).fill("x") },
      { weekNumber: 1, day: "monday", mealType: "lunch", dishes: { $gt: "" } },
    ]) {
      expect((await POST(req("/api/admin/menu", { method: "POST", session: true, headers: sameOrigin, body }))).status).toBe(400);
    }
    const del = await DELETE(req("/api/admin/menu?weekNumber=1&day=x%2Fy&mealType=lunch", { method: "DELETE", session: true, headers: sameOrigin }));
    expect(del.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps request bodies even when Content-Length lies", async () => {
    const { POST } = await import("@/app/api/admin/menu/bulk/route");
    const big = JSON.stringify({ week1: "a".repeat(120 * 1024) });
    const res = await POST(req("/api/admin/menu/bulk", { method: "POST", session: true, headers: { ...sameOrigin, "content-length": "10" }, rawBody: big }));
    expect(res.status).toBe(413);
  });

  it("forwards only week1/week2 from bulk bodies", async () => {
    const { POST } = await import("@/app/api/admin/menu/bulk/route");
    await POST(req("/api/admin/menu/bulk", { method: "POST", session: true, headers: sameOrigin, body: { week2: { monday: {} }, evil: 1 } }));
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ week2: { monday: {} } });
  });

  it("hides backend credential failures and errors behind 502s", async () => {
    const { GET } = await import("@/app/api/admin/week/route");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 401 }));
    const authFail = await GET(req("/api/admin/week", { session: true }));
    expect(authFail.status).toBe(502);
    expect((await authFail.json()).code).toBe("backend_auth_failed");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "stack trace here" }), { status: 500 }));
    const boom = await GET(req("/api/admin/week", { session: true }));
    expect(boom.status).toBe(502);
    expect(JSON.stringify(await boom.json())).not.toContain("stack trace");

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await GET(req("/api/admin/week", { session: true }))).status).toBe(502);
  });

  it("reduce backend 4xx bodies to the human-readable message", async () => {
    const { POST } = await import("@/app/api/admin/meals/route");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, message: "Meal not found", code: "meal_not_found", internal: { db: "x" } }), { status: 404 })
    );
    const res = await POST(req("/api/admin/meals", { method: "POST", session: true, headers: sameOrigin, body: { items: ["x"], mealId: "meal_1" } }));
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Meal not found", message: "Meal not found", code: "meal_not_found" });
  });

  it("passes backend validation messages through", async () => {
    const { POST } = await import("@/app/api/admin/meals/route");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Meal not found" }), { status: 404 }));
    const res = await POST(req("/api/admin/meals", { method: "POST", session: true, headers: sameOrigin, body: { items: ["x"], mealId: "meal_1" } }));
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("Meal not found");
  });
});
