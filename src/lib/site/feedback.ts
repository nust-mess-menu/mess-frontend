"use client";

import { getJson } from "./storage";
import type { SessionUser } from "./types";

/**
 * Private problem reports (Userback) - separate from public meal reviews.
 *
 * Loaded with Userback's standard snippet: set the access token on
 * window.Userback, then add widget/v1.js. Menu mismatches and bugs go only
 * through this widget.
 */
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_USERBACK_TOKEN ?? "";
const WIDGET_SRC = "https://static.userback.io/widget/v1.js";
const OPEN_WAIT_MS = 10_000;

interface UserbackGlobal {
  access_token?: string;
  on_load?: () => void;
  user_data?: { id: string; info: { name?: string; email?: string } };
  isLoaded?: () => boolean;
  open?: (type?: string, destination?: string) => void;
  openForm?: (type?: string) => void;
  show?: () => void;
  identify?: (id: string, info: { name?: string; email?: string }) => void;
}

declare global {
  interface Window {
    Userback?: UserbackGlobal;
  }
}

let started = false;
let loaded = false; // set by Userback's on_load - its API functions exist before that
let shownAt = 0;
// show() initialises asynchronously; openForm() right after it is ignored
const SHOW_SETTLE_MS = 400;

export function isFeedbackConfigured(): boolean {
  return Boolean(ACCESS_TOKEN);
}

/** The signed-in student, so reports can be followed up. */
function currentUser(): UserbackGlobal["user_data"] | undefined {
  const user = getJson<SessionUser>("user");
  if (!user?.uid) return undefined;
  return {
    id: user.uid,
    info: { name: user.displayName ?? undefined, email: user.email ?? undefined },
  };
}

/** Load the widget once, in the background. */
export function startFeedback(): void {
  if (started || !ACCESS_TOKEN || typeof window === "undefined") return;
  started = true;

  window.Userback = window.Userback || {};
  window.Userback.access_token = ACCESS_TOKEN;
  // Keep the widget initialised (autohide would ignore open calls) - its
  // floating launcher is hidden with CSS (reportProblem.css), so the form opens
  // only from "Report it privately"
  window.Userback.on_load = () => {
    loaded = true;
    shownAt = Date.now();
    window.Userback?.show?.();
  };
  const user = currentUser();
  if (user) window.Userback.user_data = user;

  const s = document.createElement("script");
  s.async = true;
  s.src = WIDGET_SRC;
  s.onerror = () => {
    started = false;
  };
  (document.head || document.body).appendChild(s);
}

/** Open the Userback form (waiting briefly if the widget is still loading). */
export function openFeedback(): void {
  startFeedback();
  const startedAt = Date.now();

  const tryOpen = () => {
    const ub = window.Userback;
    const ready = loaded || ub?.isLoaded?.() === true;
    if (ready && typeof ub?.show === "function" && typeof ub.openForm === "function") {
      if (!shownAt) {
        shownAt = Date.now();
        ub.show();
      }
      const wait = shownAt + SHOW_SETTLE_MS - Date.now();
      if (wait > 0) {
        setTimeout(tryOpen, wait);
        return;
      }
      const user = currentUser();
      if (user && typeof ub.identify === "function") ub.identify(user.id, user.info);
      ub.openForm("general");
      return;
    }
    if (Date.now() - startedAt < OPEN_WAIT_MS) {
      setTimeout(tryOpen, 200);
      return;
    }
    // Userback could not load (domain not allowed in the Userback project, or
    // blocked by an ad blocker) - say so instead of failing silently
    alert("The problem-report form couldn't open. If you use an ad blocker, allow this site and try again.");
  };
  tryOpen();
}
