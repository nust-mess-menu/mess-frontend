import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Client-side menu caching: stale-while-revalidate over localStorage, offline
 * fallback, day rollover, and in-place rating patches.
 */

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const slot = (mealId: string, extra: Record<string, unknown> = {}) => ({
  mealId,
  name: "",
  items: ["Daal"],
  averageRating: null,
  ratingCount: 0,
  commentCount: 0,
  userRating: null,
  ...extra,
});
const todayPayload = (lunchItems: string[]) => ({
  date: "2026-10-14",
  day: "wednesday",
  weekNumber: 1,
  meals: { breakfast: slot("m_b"), lunch: { ...slot("m_l"), items: lunchItems }, dinner: slot("m_d") },
});

let storage: MemoryStorage;
let fetchMock: ReturnType<typeof vi.fn>;
const NOW = new Date("2026-10-14T08:00:00Z").getTime();

async function setup() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.edu";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "k";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "x.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "x";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1:web:1";
  const { makeStore } = await import("@/lib/site/store");
  const menu = await import("@/lib/site/menuSlice");
  return { store: makeStore(), ...menu };
}

function seedCache(data: unknown, ageMs: number, day = new Date(NOW).toDateString()) {
  storage.setItem("todayMenuV2", JSON.stringify(data));
  storage.setItem("todayMenuTimeV2", String(NOW - ageMs));
  storage.setItem("todayMenuDateV2", day);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: () => true });
  fetchMock = vi.fn(async () => new Response(JSON.stringify(todayPayload(["Network Biryani"])), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("menu cache (stale-while-revalidate)", () => {
  it("serves a fresh cache without any request", async () => {
    const { store, fetchTodayMenu } = await setup();
    seedCache(todayPayload(["Cached Daal"]), 20_000);
    await store.dispatch(fetchTodayMenu());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Cached Daal"]);
  });

  it("paints a stale cache instantly, then replaces it with fresh data", async () => {
    const { store, fetchTodayMenu } = await setup();
    seedCache(todayPayload(["Cached Daal"]), 5 * 60_000);

    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Response(JSON.stringify(todayPayload(["Network Biryani"])), { status: 200 }));
        })
    );
    const pending = store.dispatch(fetchTodayMenu());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    // Request still in flight: the cached menu is already on screen
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Cached Daal"]);

    release();
    await pending;
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Network Biryani"]);
    expect(JSON.parse(storage.getItem("todayMenuV2")!).meals.lunch.items).toEqual(["Network Biryani"]);
    expect(Number(storage.getItem("todayMenuTimeV2"))).toBeGreaterThanOrEqual(NOW); // re-stamped as fresh
  });

  it("keeps the cached menu (no error) when the refresh fails", async () => {
    const { store, fetchTodayMenu } = await setup();
    seedCache(todayPayload(["Cached Daal"]), 5 * 60_000);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await store.dispatch(fetchTodayMenu());
    expect(store.getState().menu.todayError).toBeNull();
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Cached Daal"]);
  });

  it("shows an error only when there is nothing cached", async () => {
    const { store, fetchTodayMenu } = await setup();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await store.dispatch(fetchTodayMenu());
    expect(store.getState().menu.todayError).toBe("Failed to fetch today's menu");
  });

  it("ignores a cache from another day or older than an hour", async () => {
    const { store, fetchTodayMenu } = await setup();
    seedCache(todayPayload(["Yesterday"]), 1000, new Date(NOW - 86_400_000).toDateString());
    await store.dispatch(fetchTodayMenu());
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Network Biryani"]);

    seedCache(todayPayload(["Too old"]), 61 * 60_000);
    fetchMock.mockClear();
    await store.dispatch(fetchTodayMenu());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("skipCache always goes to the network", async () => {
    const { store, fetchTodayMenu } = await setup();
    seedCache(todayPayload(["Cached Daal"]), 1000);
    await store.dispatch(fetchTodayMenu(true));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ignores corrupted cache entries", async () => {
    const { store, fetchTodayMenu } = await setup();
    storage.setItem("todayMenuV2", "{not json");
    storage.setItem("todayMenuTimeV2", String(NOW));
    storage.setItem("todayMenuDateV2", new Date(NOW).toDateString());
    await store.dispatch(fetchTodayMenu());
    expect(store.getState().menu.todayMenu?.meals.lunch?.items).toEqual(["Network Biryani"]);
  });
});

describe("rating patches", () => {
  it("applies the server's exact totals to state and cache without refetching", async () => {
    const { store, fetchTodayMenu, submitMealRating } = await setup();
    seedCache(todayPayload(["Cached Daal"]), 1000);
    await store.dispatch(fetchTodayMenu());

    // Signed in (the thunk requires a user; the token comes from Firebase)
    store.dispatch({ type: "auth/restoreSession/fulfilled", payload: { uid: "u1", email: null, displayName: null, photoURL: null } });
    const firebase = await import("@/lib/site/firebase");
    vi.spyOn(firebase, "getIdTokenSafely").mockResolvedValue("tok.en.x");
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, mealId: "m_l", stats: { averageRating: 7.5, ratingCount: 4, commentCount: 2 } }), { status: 200 })
    );

    await store.dispatch(submitMealRating({ mealId: "m_l", rating: 8 }));

    expect(fetchMock).toHaveBeenCalledOnce(); // the submit only - no menu refetch
    expect(store.getState().menu.todayMenu?.meals.lunch).toMatchObject({
      userRating: 8,
      averageRating: 7.5,
      ratingCount: 4,
      commentCount: 2,
    });
    // Other meals untouched
    expect(store.getState().menu.todayMenu?.meals.dinner?.userRating).toBeNull();
    // Cached copy patched, timestamp preserved
    expect(JSON.parse(storage.getItem("todayMenuV2")!).meals.lunch.averageRating).toBe(7.5);
    expect(storage.getItem("todayMenuTimeV2")).toBe(String(NOW - 1000));
  });

  it("applyRatingToWeek patches every day the meal is served", async () => {
    const { applyRatingToWeek } = await setup();
    const week = {
      weekNumber: 1 as const,
      startDate: "",
      endDate: "",
      menu: {
        monday: { breakfast: slot("m_x"), lunch: slot("m_y"), dinner: null },
        thursday: { breakfast: null, lunch: slot("m_x"), dinner: slot("m_z") },
      },
    } as never;
    const patched = applyRatingToWeek(week, { mealId: "m_x", rating: 6, stats: { averageRating: 6, ratingCount: 1, commentCount: 0 } });
    const menu = (patched as { menu: Record<string, Record<string, { userRating: number | null } | null>> }).menu;
    expect(menu.monday.breakfast?.userRating).toBe(6);
    expect(menu.thursday.lunch?.userRating).toBe(6);
    expect(menu.monday.lunch?.userRating).toBeNull();
    expect(menu.monday.dinner).toBeNull();
  });
});
