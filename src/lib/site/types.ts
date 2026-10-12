export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type MealType = "breakfast" | "lunch" | "dinner";

export interface MealWithRating {
  mealId: string;
  name?: string;
  items: string[];
  averageRating: number | null;
  ratingCount: number;
  commentCount: number;
  userRating: number | null;
}

export type DaySlots = Record<MealType, MealWithRating | null>;

export interface TodayMenu {
  date: string;
  day: DayOfWeek;
  weekNumber: 1 | 2;
  meals: DaySlots;
}

export interface WeeklyMenu {
  weekNumber: 1 | 2;
  startDate: string;
  endDate: string;
  menu: Record<DayOfWeek, DaySlots>;
}

export interface MealComment {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
  upvotes: number;
  hasUpvoted: boolean;
}

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
  username?: string;
}
