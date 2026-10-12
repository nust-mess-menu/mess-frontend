import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiUrl, errorMessage } from "./api";
import { getIdTokenSafely } from "./firebase";
import { sessionExpired } from "./authSlice";
import { TODAY_KEYS, WEEKLY_KEYS } from "./menuCache";
import { getItem, getJson, removeItem, setItem } from "./storage";
import type { TodayMenu, WeeklyMenu } from "./types";
import type { RootState } from "./store";

/**
 * Menu data with a localStorage cache valid for 1 hour AND the same calendar
 * day. Keys match the original app so returning visitors keep their cache.
 */

const CACHE_TTL = 60 * 60 * 1000;
const TODAY = TODAY_KEYS;
const WEEKLY = WEEKLY_KEYS;

/** Remove cache keys from older app versions. Called once at startup. */
export function cleanLegacyCache(): void {
  for (const k of ["todayMenu", "todayMenuTime", "todayMenuDate", "weeklyMenu", "weeklyMenuTime", "weeklyMenuDate"]) {
    removeItem(k);
  }
}

function readCache<T>(keys: typeof TODAY): T | null {
  const time = Number(getItem(keys.time));
  if (getItem(keys.date) !== new Date().toDateString() || !time || Date.now() - time >= CACHE_TTL) return null;
  return getJson<T>(keys.data);
}

function writeCache(keys: typeof TODAY, data: unknown): void {
  setItem(keys.data, JSON.stringify(data));
  setItem(keys.time, String(Date.now()));
  setItem(keys.date, new Date().toDateString());
}

async function authHeaders(state: RootState): Promise<Record<string, string>> {
  // Menus are public; a token only adds the user's own ratings
  if (!state.auth.user) return {};
  const idToken = await getIdTokenSafely();
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

function isToday(x: unknown): x is TodayMenu {
  return Boolean(x && typeof x === "object" && "meals" in x && (x as TodayMenu).meals);
}
function isWeekly(x: unknown): x is WeeklyMenu {
  return Boolean(x && typeof x === "object" && "menu" in x && (x as WeeklyMenu).menu);
}

export const fetchTodayMenu = createAsyncThunk<TodayMenu, boolean | void, { state: RootState; rejectValue: string }>(
  "menu/fetchToday",
  async (skipCache, { getState, rejectWithValue }) => {
    try {
      if (!skipCache) {
        const cached = readCache<TodayMenu>(TODAY);
        if (isToday(cached)) return cached;
      }
      const response = await fetch(apiUrl("/api/v2/menu/today"), { headers: await authHeaders(getState()) });
      if (!response.ok) throw new Error("Failed to fetch today's menu");
      const data: unknown = await response.json();
      if (!isToday(data)) throw new Error("Failed to fetch today's menu");
      writeCache(TODAY, data);
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message || "Failed to fetch today's menu");
    }
  }
);

export const fetchWeeklyMenu = createAsyncThunk<WeeklyMenu, boolean | void, { state: RootState; rejectValue: string }>(
  "menu/fetchWeekly",
  async (skipCache, { getState, rejectWithValue }) => {
    try {
      if (!skipCache) {
        const cached = readCache<WeeklyMenu>(WEEKLY);
        if (isWeekly(cached)) return cached;
      }
      const response = await fetch(apiUrl("/api/v2/menu/week"), { headers: await authHeaders(getState()) });
      if (!response.ok) throw new Error("Failed to fetch weekly menu");
      const data: unknown = await response.json();
      if (!isWeekly(data)) throw new Error("Failed to fetch weekly menu");
      writeCache(WEEKLY, data);
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message || "Failed to fetch weekly menu");
    }
  }
);

export const submitMealRating = createAsyncThunk<
  unknown,
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
    return await response.json();
  } catch (error) {
    return rejectWithValue((error as Error).message || "Failed to submit rating");
  }
});

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
      .addCase(submitMealRating.fulfilled, (state) => {
        state.ratingsLoading = false;
      })
      .addCase(submitMealRating.rejected, (state, action) => {
        state.ratingsLoading = false;
        state.ratingsError = action.payload ?? null;
      });
  },
});

export const menuReducer = menuSlice.reducer;
