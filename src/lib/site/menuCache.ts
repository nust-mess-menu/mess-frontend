import { removeItem } from "./storage";

/** localStorage keys for cached menus (same names as the original app). */
export const TODAY_KEYS = { data: "todayMenuV2", time: "todayMenuTimeV2", date: "todayMenuDateV2" };
export const WEEKLY_KEYS = { data: "weeklyMenuV2", time: "weeklyMenuTimeV2", date: "weeklyMenuDateV2" };

/**
 * Cached menus can carry the signed-in student's own ratings, so they are
 * dropped on sign-out - the next person on a shared computer must not see them.
 */
export function clearMenuCache(): void {
  for (const keys of [TODAY_KEYS, WEEKLY_KEYS]) {
    removeItem(keys.data);
    removeItem(keys.time);
    removeItem(keys.date);
  }
}
