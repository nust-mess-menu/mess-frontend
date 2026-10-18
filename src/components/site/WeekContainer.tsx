"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/site/store";
import type { DayOfWeek, DaySlots, MealType, MealWithRating } from "@/lib/site/types";
import { SLOT_BADGE, activeMealAt, useActiveMeal } from "@/lib/site/mealTime";
import MealRatingModal from "./MealRatingModal";
import { cx, SLOT_BADGE_BASE, SLOT_BADGE_CLASS } from "./shellClasses";
import Spotlight from "./Spotlight";
import { StarIcon, useMealRating } from "./useMealRating";

const SMALL_BTN =
  "inline-flex items-center px-[11px] py-[5px] border rounded-[6px] text-[0.75rem] font-semibold leading-[1.2] transition-all duration-200 ease-[ease] active:translate-y-px";

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={cx("transition-transform duration-200 ease-[ease] motion-reduce:transition-none", open && "rotate-180")}
    viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
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

/** Day `index` (0 = Monday) of the week starting on `startDate` (YYYY-MM-DD, a Monday) */
function weekDay(startDate: string, index: number): Date {
  return new Date(Date.parse(`${startDate}T00:00:00Z`) + index * 86_400_000);
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
  startDate,
}: {
  weeklyMenu: Record<DayOfWeek, DaySlots>;
  weekNumber: number;
  startDate: string;
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

  // Dates come from the API's week and "today" from Pakistan time, so the
  // page reads the same from any time zone (crawlers included)
  const { weekRange, todayKey } = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: "UTC" };
    return {
      weekRange: `${weekDay(startDate, 0).toLocaleDateString("en-GB", options)} to ${weekDay(startDate, 6).toLocaleDateString("en-GB", options)}`,
      todayKey: activeMealAt().day,
    };
  }, [startDate]);

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

    const status = isActive ? active.status : null;

    return (
      <div
        className={cx(
          "flex flex-col gap-[6px] px-4 py-[14px] max-[561px]:px-[14px] max-[561px]:py-3",
          status === "now"
            ? "bg-[#f1f7e2] shadow-[inset_4px_0_0_#9bb158]"
            : status === "next"
              ? "bg-[#f8fbf1] shadow-[inset_4px_0_0_#b9cc8a]"
              : "bg-white"
        )}
        key={mealType}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[0.7rem] font-bold tracking-[0.06em] uppercase text-[#6b737d]">
            {MEAL_LABELS[mealType]}
            {status && <span className={cx(SLOT_BADGE_BASE, SLOT_BADGE_CLASS[status])}>{SLOT_BADGE[status]}</span>}
          </span>
          <span className="text-[0.7rem] text-[#a8afb8] whitespace-nowrap">{timing}</span>
        </div>

        {title && <div className="font-semibold text-[0.88rem] text-[#30363d]">{title}</div>}
        <div className="text-[0.88rem] leading-[1.5] text-[#3d444d] max-[561px]:text-[0.85rem]">{items}</div>

        <div className="flex flex-wrap items-center gap-[5px] text-[0.78rem] text-[#5c646f]">
          {hasRating ? (
            <>
              <StarIcon className="inline-flex shrink-0" size={13} />
              <span className="font-semibold tabular-nums">{mealData!.averageRating!.toFixed(1)}/10</span>
              <span className="text-[#8b939d]">({mealData!.ratingCount})</span>
            </>
          ) : (
            <span className="text-[#8b939d]">No ratings yet</span>
          )}
          {userHasRated && (
            <span className="text-[0.72rem] text-[#7c9341] bg-[#f3f8e7] rounded-[4px] px-[6px] py-px">
              You rated {mealData!.userRating}/10
            </span>
          )}
        </div>

        {hasMenu && (
          <div className="flex flex-wrap gap-[6px] mt-[2px]">
            <button
              className={cx(SMALL_BTN, "bg-[#f3f8e7] text-[#6f8438] border-[#8fab55] hover:bg-[#e8f1d1] hover:border-[#9bb158]")}
              onClick={() => handleRateClick(day, mealType)}
            >
              {userHasRated ? "Edit" : "Rate"}
            </button>
            <button
              className={cx(
                SMALL_BTN,
                "bg-white text-[#4a525c] border-[#9aa3ad] hover:bg-[#f5f6f8] hover:border-[#bfc4cb] hover:text-[#30363d]"
              )}
              onClick={() => setShowRatingModal({ day, mealType, tab: "reviews" })}
            >
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

    const dateLabel = weekDay(startDate, index).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const timings = getTimings(day);
    const panelId = `day-panel-${day}`;

    return (
      <div
        className={cx(
          "day-card bg-white border rounded-[8px] overflow-hidden transition-[border-color,box-shadow] duration-150 ease-[ease]",
          isExpanded && "is-open shadow-[0_3px_10px_rgba(20,24,30,0.12)]",
          // Today gets a quiet olive edge rather than a loud fill
          isToday ? "is-today border-[#9bb158] border-l-4" : isExpanded ? "border-[#8f99a4]" : "border-[#aab2bc]"
        )}
        key={day}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-4 py-[14px] bg-transparent border-none text-left transition-[background] duration-150 ease-[ease] hover:bg-[#fafbfc] focus-visible:outline-2 focus-visible:outline-[#7c9341] focus-visible:-outline-offset-2 max-[561px]:px-[14px] max-[561px]:py-3"
          onClick={() => toggleDay(day)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.95rem] font-semibold text-[#24292f] max-[561px]:text-[0.9rem]">{DAY_LABELS[day]}</span>
              <span className="text-[0.78rem] text-[#8b939d]">{dateLabel}</span>
              {isToday && (
                <span className="text-[0.64rem] font-bold tracking-[0.05em] uppercase text-[#6f8438] bg-[#f0f6e2] border border-[#dbe8bd] rounded-[4px] px-[5px] py-px">
                  Today
                </span>
              )}
            </div>
            {/* One line only - the card opens for the full picture */}
            {!isExpanded && <p className="day-preview mt-[3px] mb-0 text-[0.8rem] text-[#8b939d] truncate">{getDayPreview(dayMenu)}</p>}
          </div>
          <div className="flex items-center gap-[10px] shrink-0 text-[#6b737d]">
            <ChevronIcon open={isExpanded} />
          </div>
        </button>

        {isExpanded && (
          <div
            className="grid grid-cols-3 gap-px bg-[#c3c9d0] border-t border-[#c3c9d0] animate-day-open motion-reduce:animate-none max-[821px]:grid-cols-2 max-[561px]:grid-cols-1"
            id={panelId}
            role="region"
            aria-label={`${DAY_LABELS[day]} menu`}
          >
            {MEAL_TYPES.map((mealType) => renderMeal(day, mealType, dayMenu?.[mealType], timings[mealType]))}
          </div>
        )}
      </div>
    );
  };

  const selected = showRatingModal ? weeklyMenu?.[showRatingModal.day]?.[showRatingModal.mealType] : null;

  return (
    <>
      <div id="weekContainer" className="w-full max-w-[860px] px-3 mx-auto my-4">
        <div className="flex items-end justify-between gap-4 mb-4 max-[561px]:items-start">
          <div>
            <h3 className="m-0 text-[1.25rem] font-semibold text-[#24292f] max-[561px]:text-[1.1rem]">{weekRange}</h3>
            {weekNumber && <p className="mt-[2px] mb-0 text-[0.78rem] text-[#8b939d]">Week {weekNumber} menu rotation</p>}
          </div>
          <button
            type="button"
            className="shrink-0 px-3 py-[6px] text-[0.76rem] font-semibold text-[#4d545d] bg-white border border-[#9aa3ad] rounded-[6px] transition-[background,border-color] duration-150 ease-[ease] hover:bg-[#f5f6f8] hover:border-[#bfc4cb]"
            onClick={() => setExpandedDays(allExpanded ? [] : [...DAYS])}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div
          className={cx(
            "flex flex-col gap-2 transition-[opacity,translate] duration-300 ease-[ease] motion-reduce:transition-none",
            isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[6px]"
          )}
        >
          {DAYS.map((day, i) => renderDay(day, i))}
        </div>
        <Spotlight slot="week" className="mt-5" />
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
