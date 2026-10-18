"use client";

import { useMemo, useSyncExternalStore } from "react";
import { orderSpotlights, sanitizeSpotlights, snoozeUntil, type Spotlight, type SpotlightSlot } from "@/components/spotlight/model";
import { apiUrl } from "./api";
import { getJson, setItem } from "./storage";

/**
 * Live spotlight campaigns for the student site.
 *
 * Stale-while-revalidate: the last list is kept in localStorage and painted
 * immediately on the next visit (so the card does not pop in late), then
 * revalidated once per page load, so an admin's edit shows on the next visit.
 * The request is cheap (CDN-cached, usually a 304). A failed refresh keeps
 * what we had; spotlight never shows errors.
 *
 * The fetch starts only when a slot first renders, which is after the menu
 * has loaded, so it never competes with the menu request.
 */
const CACHE_KEY = "spotlightV1";
const DISMISSED_KEY = "spotlightDismissed";

interface State {
  campaigns: Spotlight[];
  dismissed: Record<string, number>; // campaign id -> hidden until (ms)
  at: number; // when the state last changed, used as "now" for picking
}

const SERVER_STATE: State = { campaigns: [], dismissed: {}, at: 0 };
// Fixed per page view: the order is random between visits, stable within one
const VIEW_SEED = Math.random();

let state: State = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function emit(next: Omit<State, "at">) {
  state = { ...next, at: Date.now() };
  for (const listener of listeners) listener();
}

function readDismissed(now: number): Record<string, number> {
  const raw = getJson<Record<string, unknown>>(DISMISSED_KEY) ?? {};
  const out: Record<string, number> = {};
  // Expired snoozes are dropped, so the stored map never grows
  for (const [id, until] of Object.entries(raw)) if (typeof until === "number" && until > now) out[id] = until;
  return out;
}

async function refresh(): Promise<void> {
  try {
    const response = await fetch(apiUrl("/api/v2/spotlight"));
    if (!response.ok) return;
    const body = (await response.json()) as { campaigns?: unknown };
    const campaigns = sanitizeSpotlights(body.campaigns);
    setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), campaigns }));
    // Re-render only when something changed, so an unchanged card never flickers
    if (JSON.stringify(campaigns) !== JSON.stringify(state.campaigns)) emit({ ...state, campaigns });
  } catch {
    // Best-effort: keep the cached list
  }
}

function start() {
  if (started) return;
  started = true;
  const now = Date.now();
  const cached = getJson<{ campaigns?: unknown }>(CACHE_KEY);
  emit({ campaigns: sanitizeSpotlights(cached?.campaigns), dismissed: readDismissed(now) });
  void refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/** The campaigns for a slot on this page view, in display order. Always empty during SSR. */
export function useSpotlights(slot: SpotlightSlot): Spotlight[] {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return useMemo(
    () => orderSpotlights(snapshot.campaigns, slot, snapshot.at, snapshot.dismissed, VIEW_SEED),
    [snapshot, slot]
  );
}

/** Hide a campaign in this browser for its snooze period. */
export function dismissSpotlight(campaign: Spotlight): void {
  const now = Date.now();
  const dismissed = { ...readDismissed(now), [campaign.id]: snoozeUntil(campaign, now) };
  setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  emit({ ...state, dismissed });
}
