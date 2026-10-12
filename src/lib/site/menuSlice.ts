import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { apiUrl, errorMessage } from "./api";
import { getIdTokenSafely } from "./firebase";
import { sessionExpired } from "./authSlice";
import { TODAY_KEYS, WEEKLY_KEYS } from "./menuCache";
import { getItem, getJson, removeItem, setItem } from "./storage";
import type { DaySlots, MealWithRating, TodayMenu, WeeklyMenu } from "./types";
import type { RootState } from "./store";

/**
 * Menu data with a stale-while-revalidate localStorage cache.
 *
 * - Fresher than FRESH_MS: served from cache, no request at all.
 * - Older (but same calendar day and under MAX_AGE_MS): painted from cache
 *   instantly, then refreshed in the background. A failed refresh keeps the
 *   cached menu on screen instead of replacing it with an error.
 * - Older than MAX_AGE_MS or from another day: discarded; fetched with a spinner.
 *
 * Storage keys match the original app, so returning visitors keep their cache.
 */

const FRESH_MS = 60 * 1000;
const MAX_AGE_MS = 60 * 60 * 1000;
const TODAY = TODAY_KEYS;
const WEEKLY = WEEKLY_KEYS;

/** Remove cache keys from older app versions. Called once at startup. */
export function cleanLegacyCache(): void {
  for (const k of ["todayMenu", "todayMenuTime", "todayMenuDate", "weeklyMenu", "weeklyMenuTime", "weeklyMenuDate"]) {
    removeItem(k);
  }
}

interface CacheHit<T> {
  data: T;
  ageMs: number;
}

export function readCache<T>(keys: typeof TODAY, isValid: (x: unknown) => x is T, now: number = Date.now()): CacheHit<T> | null {
  const time = Number(getItem(keys.time));
  if (getItem(keys.date) !== new Date(now).toDateString() || !time) return null;
  const ageMs = now - time;
  if (ageMs < 0 || ageMs >= MAX_AGE_MS) return null;
  const data = getJson<unknown>(keys.data);
  return isValid(data) ? { data, ageMs } : null;
}

function writeCache(keys: typeof TODAY, data: unknown, time: number = Date.now()): void {
  setItem(keys.data, JSON.stringify(data));
  setItem(keys.time, String(time));
  setItem(keys.date, new Date(time).toDateString());
}

/** Rewrite cached data in place, keeping its original timestamp. */
function patchCache<T>(keys: typeof TODAY, isValid: (x: unknown) => x is T, patch: (data: T) => T): void {
  const time = Number(getItem(keys.time));
  const data = getJson<unknown>(keys.data);
  if (time && isValid(data)) writeCache(keys, patch(data), time);
}

async function authHeaders(state: RootState): Promise<Record<string, string>> {
  // Menus are public; a token only adds the user's own ratings
  if (!state.auth.user) return {};
  const idToken = await getIdTokenSafely();
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

export function isToday(x: unknown): x is TodayMenu {
  return Boolean(x && typeof x === "object" && "meals" in x && (x as TodayMenu).meals);
}
export function isWeekly(x: unknown): x is WeeklyMenu {
  return Boolean(x && typeof x === "object" && "menu" in x && (x as WeeklyMenu).menu);
}

/** Shared fetch flow for both views. */
function menuThunk<T>(
  type: string,
  path: string,
  keys: typeof TODAY,
  isValid: (x: unknown) => x is T,
  cached: (data: T) => PayloadAction<T>,
  failure: string
) {
  return createAsyncThunk<T, boolean | void, { state: RootState; rejectValue: string }>(
    type,
    async (skipCache, { getState, dispatch, rejectWithValue }) => {
      const hit = skipCache ? null : readCache(keys, isValid);
      if (hit && hit.ageMs < FRESH_MS) return hit.data;
      // Paint the cached copy now; the request below refreshes it
      if (hit) dispatch(cached(hit.data));

      try {
        const response = await fetch(apiUrl(path), { headers: await authHeaders(getState()) });
        if (!response.ok) throw new Error(failure);
        const data: unknown = await response.json();
        if (!isValid(data)) throw new Error(failure);
        writeCache(keys, data);
        return data;
      } catch (error) {
        // Offline or the server is struggling: keep showing what we have
        if (hit) return hit.data;
        return rejectWithValue((error as Error).message || failure);
      }
    }
  );
}

export const fetchTodayMenu = menuThunk<TodayMenu>(
  "menu/fetchToday",
  "/api/v2/menu/today",
  TODAY,
  isToday,
  (data) => todayCached(data),
  "Failed to fetch today's menu"
);

export const fetchWeeklyMenu = menuThunk<WeeklyMenu>(
  "menu/fetchWeekly",
  "/api/v2/menu/week",
  WEEKLY,
  isWeekly,
  (data) => weeklyCached(data),
  "Failed to fetch weekly menu"
);

export interface RatingResult {
  mealId: string;
  rating: number;
  stats: { averageRating: number | null; ratingCount: number; commentCount: number } | null;
}

export const submitMealRating = createAsyncThunk<
  RatingResult,
  { mealId: string; rating: number; comment?: string },
  { state: RootState; rejectValue: string }
>("menu/submitMealRating", async ({ mealId, rating, comment }, { getState, dispatch, rejectWithValue }) => {
  try {
    if (!getState().auth.user) throw new Error("Must be logged in to rate");

    const idToken = await getIdTokenSafely();
    if (!idToken) {
      // Cached session outlived the Firebase one - send the user back to sign in
      dispatch(sessionExpired());
      window.dispatchEvent(new Event("open-login-modal"));
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(apiUrl("/api/ratings/meal/submit"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mealId, rating, comment }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, "Failed to submit rating"));
    const data = (await response.json()) as { stats?: RatingResult["stats"] };
    const stats =
      data.stats && typeof data.stats.ratingCount === "number" && typeof data.stats.commentCount === "number"
        ? data.stats
        : null;
    const result = { mealId, rating, stats };
    // Keep the stored copies consistent so a reload shows the same numbers
    patchCache(TODAY, isToday, (m) => applyRatingToToday(m, result));
    patchCache(WEEKLY, isWeekly, (m) => applyRatingToWeek(m, result));
    return result;
  } catch (error) {
    return rejectWithValue((error as Error).message || "Failed to submit rating");
  }
});

/**
 * Apply a just-submitted rating to every place the meal appears.
 *
 * The totals come straight from the server's write transaction, so they are
 * exact. Refetching the menu instead could land on a backend instance whose
 * cache has not caught up yet and briefly show the old average.
 */
function applyRating(slot: MealWithRating | null, result: RatingResult): MealWithRating | null {
  if (!slot || slot.mealId !== result.mealId) return slot;
  return {
    ...slot,
    userRating: result.rating,
    ...(result.stats
      ? {
          averageRating: result.stats.averageRating,
          ratingCount: result.stats.ratingCount,
          commentCount: result.stats.commentCount,
        }
      : {}),
  };
}

function applyToDay(day: DaySlots, result: RatingResult): DaySlots {
  return {
    breakfast: applyRating(day.breakfast, result),
    lunch: applyRating(day.lunch, result),
    dinner: applyRating(day.dinner, result),
  };
}

export function applyRatingToToday(menu: TodayMenu, result: RatingResult): TodayMenu {
  return { ...menu, meals: applyToDay(menu.meals, result) };
}

export function applyRatingToWeek(menu: WeeklyMenu, result: RatingResult): WeeklyMenu {
  const days = Object.fromEntries(
    Object.entries(menu.menu).map(([day, slots]) => [day, applyToDay(slots, result)])
  ) as WeeklyMenu["menu"];
  return { ...menu, menu: days };
}

interface MenuState {
  todayMenu: TodayMenu | null;
  weeklyMenu: WeeklyMenu | null;
  todayLoading: boolean;
  weeklyLoading: boolean;
  todayError: string | null;
  weeklyError: string | null;
  ratingsLoading: boolean;
  ratingsError: string | null;
}

const initialState: MenuState = {
  todayMenu: null,
  weeklyMenu: null,
  todayLoading: false,
  weeklyLoading: false,
  todayError: null,
  weeklyError: null,
  ratingsLoading: false,
  ratingsError: null,
};

const menuSlice = createSlice({
  name: "menu",
  initialState,
  reducers: {
    clearError: (state) => {
      state.todayError = null;
      state.weeklyError = null;
      state.ratingsError = null;
    },
    todayCached: (state, action: PayloadAction<TodayMenu>) => {
      state.todayMenu = action.payload;
    },
    weeklyCached: (state, action: PayloadAction<WeeklyMenu>) => {
      state.weeklyMenu = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodayMenu.pending, (state) => {
        state.todayLoading = true;
        state.todayError = null;
      })
      .addCase(fetchTodayMenu.fulfilled, (state, action) => {
        state.todayLoading = false;
        state.todayMenu = action.payload;
      })
      .addCase(fetchTodayMenu.rejected, (state, action) => {
        state.todayLoading = false;
        state.todayError = action.payload ?? "Failed to fetch today's menu";
      })
      .addCase(fetchWeeklyMenu.pending, (state) => {
        state.weeklyLoading = true;
        state.weeklyError = null;
      })
      .addCase(fetchWeeklyMenu.fulfilled, (state, action) => {
        state.weeklyLoading = false;
        state.weeklyMenu = action.payload;
      })
      .addCase(fetchWeeklyMenu.rejected, (state, action) => {
        state.weeklyLoading = false;
        state.weeklyError = action.payload ?? "Failed to fetch weekly menu";
      })
      .addCase(submitMealRating.pending, (state) => {
        state.ratingsLoading = true;
        state.ratingsError = null;
      })
      .addCase(submitMealRating.fulfilled, (state, action) => {
        state.ratingsLoading = false;
        if (state.todayMenu) state.todayMenu = applyRatingToToday(state.todayMenu, action.payload);
        if (state.weeklyMenu) state.weeklyMenu = applyRatingToWeek(state.weeklyMenu, action.payload);
      })
      .addCase(submitMealRating.rejected, (state, action) => {
        state.ratingsLoading = false;
        state.ratingsError = action.payload ?? null;
      });
  },
});

const { todayCached, weeklyCached } = menuSlice.actions;
export const menuReducer = menuSlice.reducer;
