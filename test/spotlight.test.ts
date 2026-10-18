import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sealSession } from "@/lib/server/session";
import { isInWindow, orderSpotlights, sanitizeSpotlights, slidesOf, textOn, trackedUrl, type Spotlight } from "@/components/spotlight/model";
import { ENV, useEnv } from "./env";

const NOW = Date.parse("2026-10-18T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const spot = (overrides: Partial<Spotlight> = {}): Spotlight => ({
  id: "spot_1",
  advertiser: "Guerilla FYP",
  headline: "Stuck on your FYP?",
  body: "",
  ctaLabel: "See how it works",
  ctaUrl: "https://www.guerillafyp.space/",
  accent: "#ffc224",
  logo: "/images/spotlight/guerillafyp.svg",
  slots: ["today", "week"],
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: null,
  weight: 1,
  snoozeDays: 7,
  ...overrides,
});

describe("spotlight model", () => {
  it("respects the start and end of the window", () => {
    expect(isInWindow(spot(), NOW)).toBe(true);
    expect(isInWindow(spot({ startsAt: "2026-10-19T00:00:00Z" }), NOW)).toBe(false);
    expect(isInWindow(spot({ endsAt: "2026-10-18T09:00:00Z" }), NOW)).toBe(false);
    expect(isInWindow(spot({ startsAt: "garbage" }), NOW)).toBe(false);
  });

  it("orders eligible campaigns, skipping dismissed, out-of-slot and out-of-window ones", () => {
    const a = spot({ id: "spot_a" });
    const b = spot({ id: "spot_b", slots: ["week"] });
    const later = spot({ id: "spot_later", startsAt: "2026-11-01T00:00:00Z" });
    expect(orderSpotlights([a, b, later], "today", NOW, {}, 0.3).map((c) => c.id)).toEqual(["spot_a"]);
    expect(orderSpotlights([a], "today", NOW, { spot_a: NOW + DAY }, 0.5)).toEqual([]);
    // An expired snooze shows it again
    expect(orderSpotlights([a], "today", NOW, { spot_a: NOW - 1 }, 0.5).map((c) => c.id)).toEqual(["spot_a"]);
  });

  it("puts heavier campaigns first more often, and is stable for a given seed", () => {
    const light = spot({ id: "spot_a", weight: 1 });
    const heavy = spot({ id: "spot_b", weight: 3 });
    const firsts = Array.from({ length: 2000 }, (_, i) => orderSpotlights([light, heavy], "today", NOW, {}, i / 2000)[0]!.id);
    const heavyShare = firsts.filter((id) => id === "spot_b").length / firsts.length;
    expect(heavyShare).toBeGreaterThan(0.68); // 0.75 expected
    expect(heavyShare).toBeLessThan(0.82);
    const order = (list: Spotlight[]) => orderSpotlights(list, "today", NOW, {}, 0.42).map((c) => c.id);
    expect(order([light, heavy])).toEqual(order([heavy, light]));
  });

  it("shows at most two at a time and wraps odd counts so no slide is half empty", () => {
    const ids = (slides: Spotlight[][]) => slides.map((slide) => slide.map((c) => c.id).join("+"));
    const [a, b, c, d] = ["a", "b", "c", "d"].map((x) => spot({ id: x }));
    expect(slidesOf([])).toEqual([]);
    expect(ids(slidesOf([a!]))).toEqual(["a"]);
    expect(ids(slidesOf([a!, b!]))).toEqual(["a+b"]);
    expect(ids(slidesOf([a!, b!, c!]))).toEqual(["a+b", "c+a", "b+c"]);
    expect(ids(slidesOf([a!, b!, c!, d!]))).toEqual(["a+b", "c+d"]);
  });

  it("tags links with UTM parameters without overriding the advertiser's own", () => {
    const url = new URL(trackedUrl(spot({ ctaUrl: "https://www.guerillafyp.space/?ref=x#contact" })));
    expect(url.searchParams.get("utm_source")).toBe("messmenu");
    expect(url.searchParams.get("utm_medium")).toBe("spotlight");
    expect(url.searchParams.get("utm_campaign")).toBe("spot_1");
    expect(url.searchParams.get("ref")).toBe("x");
    expect(url.hash).toBe("#contact");
    expect(new URL(trackedUrl(spot({ ctaUrl: "https://a.example/?utm_source=ig" }))).searchParams.get("utm_source")).toBe("ig");
  });

  it("chooses readable button text for the accent", () => {
    expect(textOn("#ffc224")).toBe("#111111");
    expect(textOn("#1f2419")).toBe("#ffffff");
    expect(textOn("not-a-colour")).toBe("#ffffff");
  });

  it("drops malformed or unsafe campaigns from cached or fetched data", () => {
    const clean = sanitizeSpotlights([
      spot(),
      { ...spot({ id: "spot_js" }), ctaUrl: "javascript:alert(1)" },
      { ...spot({ id: "spot_logo" }), logo: "https://evil.example/x.png", accent: "red", weight: 99 },
      null,
      "x",
    ]);
    expect(clean.map((c) => c.id)).toEqual(["spot_1", "spot_logo"]);
    expect(clean[1]).toMatchObject({ logo: null, accent: "#9bb158", weight: 10 });
    expect(sanitizeSpotlights({ not: "an array" })).toEqual([]);
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const [uploaded, svg] = sanitizeSpotlights([
      { ...spot({ id: "spot_png" }), logo: png },
      { ...spot({ id: "spot_svg" }), logo: "data:image/svg+xml;base64,PHN2Zy8+" },
    ]);
    expect(uploaded.logo).toBe(png);
    expect(svg.logo).toBeNull();
  });
});

/* ------------------------------ BFF route ------------------------------ */

const APP = ENV.ADMIN_URL;
const COOKIE = "__Host-mess_admin";
const sameOrigin = { origin: APP };

function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; session?: boolean } = {}) {
  const headers = new Headers({ host: "mess.example.edu", ...init.headers });
  if (init.session) headers.set("cookie", `${COOKIE}=${sealSession(ENV.SESSION_SECRET).token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(path, APP), {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

const campaignBody = {
  status: "active",
  advertiser: "Guerilla FYP",
  headline: "Stuck on your FYP?",
  body: "",
  ctaLabel: "See how it works",
  ctaUrl: "https://www.guerillafyp.space/",
  accent: "#ffc224",
  logo: "/images/spotlight/guerillafyp.svg",
  slots: ["today"],
  startsAt: "2026-10-18T04:00:00.000Z",
  endsAt: null,
  weight: 1,
  snoozeDays: 7,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  useEnv();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("admin spotlight route", () => {
  it("forwards saves with only the known fields", async () => {
    const { POST } = await import("@/app/api/admin/spotlight/route");
    const res = await POST(
      req("/api/admin/spotlight", { method: "POST", session: true, headers: sameOrigin, body: { ...campaignBody, clicks: 1e6, isAdmin: true } })
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://api.example.edu/api/admin/spotlight");
    expect(init.redirect).toBe("manual");
    expect(JSON.parse(String(init.body))).toEqual(campaignBody);
  });

  it("forwards deletes by id and lists campaigns", async () => {
    const { GET, DELETE } = await import("@/app/api/admin/spotlight/route");
    expect((await GET(req("/api/admin/spotlight", { session: true }))).status).toBe(200);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.example.edu/api/admin/spotlight");

    const res = await DELETE(req("/api/admin/spotlight?id=spot_1_abc", { method: "DELETE", session: true, headers: sameOrigin }));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(String(url)).toBe("https://api.example.edu/api/admin/spotlight?id=spot_1_abc");
    expect(init.method).toBe("DELETE");
  });

  it("validates input before it reaches the backend", async () => {
    const { POST, DELETE } = await import("@/app/api/admin/spotlight/route");
    for (const body of [
      { ...campaignBody, status: "live" },
      { ...campaignBody, slots: [] },
      { ...campaignBody, slots: ["popup"] },
      { ...campaignBody, accent: "red" },
      { ...campaignBody, weight: 11 },
      { ...campaignBody, id: "spot_x/../meals" },
    ]) {
      expect((await POST(req("/api/admin/spotlight", { method: "POST", session: true, headers: sameOrigin, body }))).status).toBe(400);
    }
    const del = await DELETE(req("/api/admin/spotlight?id=..%2Fmeals", { method: "DELETE", session: true, headers: sameOrigin }));
    expect(del.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a session and same-origin mutations", async () => {
    const { GET, POST } = await import("@/app/api/admin/spotlight/route");
    expect((await GET(req("/api/admin/spotlight"))).status).toBe(401);
    expect((await POST(req("/api/admin/spotlight", { method: "POST", session: true, body: campaignBody }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
