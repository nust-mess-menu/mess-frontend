import "server-only";
import { apiUrl } from "./api";
import type { WeeklyMenu } from "./types";

/**
 * This week's menu, fetched once while the static pages are built, so the
 * HTML itself carries the dishes. Crawlers and AI assistants that don't run
 * JavaScript never see the menu the browser loads. A daily rebuild
 * (.github/workflows/deploy-site.yml) keeps it current.
 *
 * Returns null if the API is unreachable: the build goes on without it.
 */
export async function fetchWeekSnapshot(): Promise<WeeklyMenu | null> {
  try {
    const response = await fetch(apiUrl("/api/v2/menu/week"), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<WeeklyMenu> | null;
    return data?.menu && typeof data.startDate === "string" ? (data as WeeklyMenu) : null;
  } catch {
    return null;
  }
}
