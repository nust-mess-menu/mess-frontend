"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/site/store";
import type { DayOfWeek, DaySlots, MealType, MealWithRating } from "@/lib/site/types";
import { SLOT_BADGE, useActiveMeal } from "@/lib/site/mealTime";
import MealRatingModal from "./MealRatingModal";
import { StarIcon, useMealRating } from "./useMealRating";

const ChevronIcon = () => (
  <svg className="day-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/** Serving times differ at weekends, matching the Today view. */
function getTimings(day: DayOfWeek): Record<MealType, string> {
  const isWeekend = day === "saturday" || day === "sunday";
  return {
    breakfast: isWeekend ? "9:00 – 10:30 AM" : "7:30 – 9:30 AM",
    lunch: isWeekend ? "2:00 – 3:30 PM" : "1:00 – 3:30 PM",
    dinner: "7:30 – 9:30 PM",
  };
}

function getMondayOf(date = new Date()): Date {
  const monday = new Date(date);
  const weekday = date.getDay();
  monday.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** One-line "what's on" summary for the collapsed state. */
function getDayPreview(dayMenu: DaySlots | undefined): string {
  const parts = MEAL_TYPES.map((t) => {
    const items = dayMenu?.[t]?.items;
    return Array.isArray(items) && items.length > 0 ? items[0] : null;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No menu set";
}

export default function WeekContainer({
  weeklyMenu,
  weekNumber,
}: {
  weeklyMenu: Record<DayOfWeek, DaySlots>;
  weekNumber: number;
}) {
  const [isActive, setIsActive] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState<{
    day: DayOfWeek;
    mealType: MealType;
    tab: "rate" | "reviews";
  } | null>(null);
  const user = useAppSelector((state) => state.auth.user);
  // Highlight the meal being served now, or the next one, on today's card (PKT)
  const active = useActiveMeal();
  const { isSubmitting, submit, successModal } = useMealRating();

  const { monday, weekRange, todayKey } = useMemo(() => {
    const now = new Date();
    const mondayDate = getMondayOf(now);
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
    return {
      monday: mondayDate,
      weekRange: `${mondayDate.toLocaleDateString("en-GB", options)} to ${sunday.toLocaleDateString("en-GB", options)}`,
      todayKey: DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1],
    };
  }, []);

  // Today starts open so the most relevant day needs no interaction
  const [expandedDays, setExpandedDays] = useState<DayOfWeek[]>(() => [todayKey]);

  useEffect(() => {
    const timer = setTimeout(() => setIsActive(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const toggleDay = (day: DayOfWeek) =>
    setExpandedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const allExpanded = expandedDays.length === DAYS.length;

  const handleRateClick = (day: DayOfWeek, mealType: MealType) => {
    if (!user) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }
    setShowRatingModal({ day, mealType, tab: "rate" });
  };

  const renderMeal = (day: DayOfWeek, mealType: MealType, mealData: MealWithRating | null | undefined, timing: string) => {
    const isActive = active.day === day && active.mealType === mealType;
    const hasMenu = Boolean(mealData && Array.isArray(mealData.items));
    const items = hasMenu && mealData!.items.length > 0 ? mealData!.items.join(", ") : "No menu";
    const title = hasMenu && mealData!.name && mealData!.name.trim() ? mealData!.name : null;
    const hasRating = hasMenu && typeof mealData!.averageRating === "number";
    const userHasRated = hasMenu && mealData!.userRating !== null && mealData!.userRating !== undefined;
    const commentCount = (hasMenu && mealData!.commentCount) || 0;

    return (
      <div
        className={`meal-block ${isActive ? `slot-active slot-active--${active.status}` : ""}`}
        key={mealType}
      >
        <div className="meal-block-head">
          <span className="meal-type">
            {MEAL_LABELS[mealType]}
            {isActive && active.status && (
              <span className={`slot-badge slot-badge--${active.status}`}>{SLOT_BADGE[active.status]}</span>
            )}
          </span>
          <span className="meal-time">{timing}</span>
        </div>

        {title && <div className="meal-title-week">{title}</div>}
        <div className="meal-items-week">{items}</div>

        <div className="meal-rating-week">
          {hasRating ? (
            <>
              <StarIcon className="icon-inline" size={13} />
              <span className="meal-score">{mealData!.averageRating!.toFixed(1)}/10</span>
              <span className="meal-count">({mealData!.ratingCount})</span>
            </>
          ) : (
            <span className="meal-count">No ratings yet</span>
          )}
          {userHasRated && <span className="rated-note-week">You rated {mealData!.userRating}/10</span>}
        </div>

        {hasMenu && (
          <div className="meal-actions-week">
            <button className="rate-btn-sm" onClick={() => handleRateClick(day, mealType)}>
              {userHasRated ? "Edit" : "Rate"}
            </button>
            <button className="reviews-btn-sm" onClick={() => setShowRatingModal({ day, mealType, tab: "reviews" })}>
              {commentCount > 0 ? `Reviews (${commentCount})` : "Reviews"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDay = (day: DayOfWeek, index: number) => {
    const dayMenu = weeklyMenu?.[day];
    const isExpanded = expandedDays.includes(day);
    const isToday = day === todayKey;

    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const timings = getTimings(day);
    const panelId = `day-panel-${day}`;

    return (
      <div className={`day-card ${isExpanded ? "is-open" : ""} ${isToday ? "is-today" : ""}`} key={day}>
        <button
          type="button"
          className="day-header"
          onClick={() => toggleDay(day)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          <div className="day-header-main">
            <div className="day-title-row">
              <span className="day-name">{DAY_LABELS[day]}</span>
              <span className="day-date">{dateLabel}</span>
              {isToday && <span className="day-today">Today</span>}
            </div>
            {!isExpanded && <p className="day-preview">{getDayPreview(dayMenu)}</p>}
          </div>
          <div className="day-header-side">
            <ChevronIcon />
          </div>
        </button>

        {isExpanded && (
          <div className="day-panel" id={panelId} role="region" aria-label={`${DAY_LABELS[day]} menu`}>
            {MEAL_TYPES.map((mealType) => renderMeal(day, mealType, dayMenu?.[mealType], timings[mealType]))}
          </div>
        )}
      </div>
    );
  };

  const selected = showRatingModal ? weeklyMenu?.[showRatingModal.day]?.[showRatingModal.mealType] : null;

  return (
    <>
      <div id="weekContainer" className="container my-3">
        <div className="week-head">
          <div>
            <h3 className="week-range">{weekRange}</h3>
            {weekNumber && <p className="week-sub">Week {weekNumber} menu rotation</p>}
          </div>
          <button type="button" className="week-toggle-all" onClick={() => setExpandedDays(allExpanded ? [] : [...DAYS])}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className={`week-list ${isActive ? "active" : ""}`}>{DAYS.map((day, i) => renderDay(day, i))}</div>
      </div>

      {showRatingModal && selected && (
        <MealRatingModal
          mealName={`${DAY_LABELS[showRatingModal.day]} ${MEAL_LABELS[showRatingModal.mealType]}`}
          items={selected.items}
          mealId={selected.mealId}
          currentRating={selected.userRating}
          averageRating={selected.averageRating}
          ratingCount={selected.ratingCount}
          commentCount={selected.commentCount || 0}
          initialTab={showRatingModal.tab}
          canRate={Boolean(user)}
          onRequestLogin={() => {
            setShowRatingModal(null);
            window.dispatchEvent(new Event("open-login-modal"));
          }}
          onSubmit={(mealId, rating, comment) => submit(mealId, rating, comment, () => setShowRatingModal(null))}
          onClose={() => setShowRatingModal(null)}
          isSubmitting={isSubmitting}
        />
      )}

      {successModal}
    </>
  );
}
