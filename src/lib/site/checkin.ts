"use client";

import { apiUrl } from "./api";
import { getIdTokenSafely } from "./firebase";
import { getItem, getJson, setItem } from "./storage";

/**
 * Daily check-in: tells the backend this browser opened the site today, for
 * the admin's visitor stats. Sent at most once per Pakistan calendar day per
 * browser; the backend de-duplicates as well, so repeats never inflate counts.
 *
 * The visitor ID is random (no personal data) and only its hash is stored.
 */
const VISITOR_KEY = "visitorId";
const LAST_CHECKIN_KEY = "lastCheckinPkt";

const pktDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }); // YYYY-MM-DD

function visitorId(): string {
  let id = getItem(VISITOR_KEY);
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    setItem(VISITOR_KEY, id);
  }
  return id;
}

export async function checkIn(): Promise<void> {
  const today = pktDate.format(new Date());
  if (getItem(LAST_CHECKIN_KEY) === today) return;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Counted as "signed in" when a session exists
    if (getJson<{ uid?: string }>("user")?.uid) {
      const token = await getIdTokenSafely();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(apiUrl("/api/stats/checkin"), {
      method: "POST",
      headers,
      body: JSON.stringify({ visitorId: visitorId() }),
      keepalive: true,
    });
    if (response.ok) setItem(LAST_CHECKIN_KEY, today);
  } catch {
    // Stats are best-effort; never disturb the visitor
  }
}
