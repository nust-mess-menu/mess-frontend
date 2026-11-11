import "server-only";
import { apiUrl } from "./api";
import type { TodayMenu, WeeklyMenu } from "./types";

/**
 * The menu, fetched once while the static pages are built, so the HTML itself
 * carries the dishes. Crawlers and AI assistants that don't run JavaScript
 * never see the menu the browser loads. A nightly rebuild just after midnight
 * PKT (.github/workflows/deploy-site.yml) keeps it current.
 *
 * Each returns null if the API is unreachable: the build goes on without it.
 */
async function fetchSnapshot<T>(path: string, isValid: (data: Partial<T>) => boolean): Promise<T | null> {
  try {
    const response = await fetch(apiUrl(path), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<T> | null;
    return data && isValid(data) ? (data as T) : null;
  } catch {
    return null;
  }
}

/** This week's menu (the /weekly page) */
export const fetchWeekSnapshot = () =>
  fetchSnapshot<WeeklyMenu>("/api/v2/menu/week", (d) => Boolean(d.menu) && typeof d.startDate === "string");

/** Today's menu in Pakistan time (the home page) */
export const fetchTodaySnapshot = () =>
  fetchSnapshot<TodayMenu>("/api/v2/menu/today", (d) => Boolean(d.meals) && typeof d.date === "string");
