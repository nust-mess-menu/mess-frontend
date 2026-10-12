export type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type MealType = "breakfast" | "lunch" | "dinner";
export type Week = 1 | 2;

export const DAYS: Day[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

export const DAY_LABEL: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export interface Meal {
  id: string;
  name: string;
  items: string[];
  category?: MealType;
  createdAt?: string;
  updatedAt?: string;
}

export type WeekIds = Record<Day, Record<MealType, string | null>>;
export type WeekDishes = Record<Day, Record<MealType, string[]>>;

export interface SlotRef {
  week: Week;
  day: Day;
  mealType: MealType;
}

export const slotLabel = (s: SlotRef) => `Week ${s.week} · ${DAY_LABEL[s.day]} · ${MEAL_LABEL[s.mealType]}`;
export const slotShort = (s: SlotRef) => `W${s.week} ${DAY_LABEL[s.day].slice(0, 3)} ${MEAL_LABEL[s.mealType]}`;

/** Today's weekday in Pakistan, regardless of the admin's own timezone. */
export function todayInPakistan(): Day {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long" }).format(new Date());
  return name.toLowerCase() as Day;
}
