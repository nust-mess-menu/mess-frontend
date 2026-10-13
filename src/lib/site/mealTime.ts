"use client";

import { useEffect, useState } from "react";
import type { DayOfWeek, MealType } from "./types";

/**
 * Which meal matters right now, in Pakistan time (the mess runs on PKT
 * regardless of where the visitor's device clock is set).
 *
 * Serving windows match the timings shown on the menu (minutes after midnight).
 */
const WINDOWS: Record<"weekday" | "weekend", Record<MealType, [number, number]>> = {
  weekday: { breakfast: [7 * 60 + 30, 9 * 60 + 30], lunch: [13 * 60, 15 * 60 + 30], dinner: [19 * 60 + 30, 21 * 60 + 30] },
  weekend: { breakfast: [9 * 60, 10 * 60 + 30], lunch: [14 * 60, 15 * 60 + 30], dinner: [19 * 60 + 30, 21 * 60 + 30] },
};

const ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

const pktFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Karachi",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface ActiveMeal {
  day: DayOfWeek;
  mealType: MealType | null;
  status: "now" | "next" | null;
}

export function activeMealAt(date: Date = new Date()): ActiveMeal {
  const parts = Object.fromEntries(pktFormat.formatToParts(date).map((p) => [p.type, p.value]));
  const day = (parts.weekday ?? "Monday").toLowerCase() as DayOfWeek;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const windows = WINDOWS[day === "saturday" || day === "sunday" ? "weekend" : "weekday"];

  for (const mealType of ORDER) {
    const [start, end] = windows[mealType];
    if (minutes >= start && minutes < end) return { day, mealType, status: "now" };
    if (minutes < start) return { day, mealType, status: "next" };
  }
  // After dinner: nothing left to serve today
  return { day, mealType: null, status: null };
}

/** The active meal, kept current while the page is open. */
export function useActiveMeal(): ActiveMeal {
  const [active, setActive] = useState(activeMealAt);
  useEffect(() => {
    const timer = setInterval(() => setActive(activeMealAt()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return active;
}

export const SLOT_BADGE: Record<"now" | "next", string> = { now: "Now serving", next: "Up next" };
