"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAppSelector } from "@/lib/site/store";
import type { DaySlots, MealType, MealWithRating } from "@/lib/site/types";
import { SLOT_BADGE, useActiveMeal } from "@/lib/site/mealTime";
import MealRatingModal from "./MealRatingModal";
import { CONTAINER, cx, SLOT_BADGE_BASE, SLOT_BADGE_CLASS } from "./shellClasses";
import Spotlight from "./Spotlight";
import { StarIcon, useMealRating } from "./useMealRating";

// Table cells (the original Bootstrap .table plus its own borders)
const CELL = "border border-[#d7d9dd] p-2 text-left";
const COL_TIME = "w-[20%] text-[0.85rem] whitespace-nowrap max-[577px]:text-[0.75rem] max-[577px]:px-1 max-[577px]:py-[6px]";
const COL_WIDE = "w-[40%] max-[577px]:text-[0.85rem]";
const HEAD_CELL = `${CELL} align-bottom font-bold shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.1)]`;

// Row tint for the meal being served now / next (PKT), with a marked leading edge
const ACTIVE_CELL = {
  now: ["shadow-[inset_4px_0_0_#9bb158,inset_0_0_0_9999px_#f1f7e2]", "shadow-[inset_0_0_0_9999px_#f1f7e2]"],
  next: ["shadow-[inset_4px_0_0_#b9cc8a,inset_0_0_0_9999px_#f8fbf1]", "shadow-[inset_0_0_0_9999px_#f8fbf1]"],
} as const;
const HOVER_CELL = "group-hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.075)]";

const SMALL_BTN =
  "inline-flex items-center px-[10px] py-1 border rounded-[6px] text-[0.76rem] font-semibold leading-[1.2] transition-all duration-200 ease-[ease] active:translate-y-px max-[577px]:text-[0.74rem] max-[577px]:px-2 max-[577px]:py-[3px]";

export default function TodayContainer({ meals, day }: { meals: DaySlots; weekNumber: number; day: string }) {
  const [isActive, setIsActive] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState<{ mealType: MealType; tab: "rate" | "reviews" } | null>(null);
  const user = useAppSelector((state) => state.auth.user);
  // Highlight the meal being served now, or the next one (PKT)
  const active = useActiveMeal();
  const { isSubmitting, submit, successModal } = useMealRating();

  // Pakistan time on both server and browser, so the two renders always agree
  const currentDate = new Date();
  const currentFormattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Karachi",
  });
  const pktWeekday = currentDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Karachi" });
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(pktWeekday);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const timings: Record<MealType, ReactNode> = {
    breakfast: isWeekend ? <>9:00 AM -<br />10:30 AM</> : <>7:30 AM -<br />9:30 AM</>,
    lunch: isWeekend ? <>2:00 PM -<br />3:30 PM</> : <>1:00 PM -<br />3:30 PM</>,
    dinner: <>7:30 PM -<br />9:30 PM</>,
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsActive(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRateClick = (mealType: MealType) => {
    if (!user) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }
    setShowRatingModal({ mealType, tab: "rate" });
  };

  const renderMealRow = (mealType: MealType, timing: ReactNode, mealData: MealWithRating | null) => {
    if (!mealData || !Array.isArray(mealData.items)) return null;

    const itemNames = mealData.items.length ? mealData.items.join(", ") : "No menu";
    const title = mealData.name && mealData.name.trim() ? mealData.name : null;
    const hasRating = typeof mealData.averageRating === "number";
    const aggregateRating = hasRating ? `${mealData.averageRating!.toFixed(1)}/10` : "No ratings yet";
    const totalRatings = mealData.ratingCount > 0 ? `(${mealData.ratingCount})` : "";
    const userHasRated = mealData.userRating !== null && mealData.userRating !== undefined;
    const commentCount = mealData.commentCount || 0;

    const status = active.day === day && active.mealType === mealType ? active.status : null;
    const [firstCell, otherCell] = status ? ACTIVE_CELL[status] : [HOVER_CELL, HOVER_CELL];

    return (
      <tr key={mealType} className={cx("group", status && `slot-active slot-active--${status}`)}>
        <td className={cx(CELL, COL_TIME, firstCell)}>{timing}</td>
        <td className={cx(CELL, COL_WIDE, otherCell)}>
          {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          {status && <span className={cx(SLOT_BADGE_BASE, SLOT_BADGE_CLASS[status])}>{SLOT_BADGE[status]}</span>}
        </td>
        <td className={cx(CELL, COL_WIDE, otherCell)}>
          <div className="flex flex-col gap-[6px]">
            {title && <div className="font-semibold text-[#30363d]">{title}</div>}
            <div className="meal-items font-medium text-[1rem] leading-[1.5] text-[#333] max-[577px]:text-[0.9rem]">{itemNames}</div>
            <div className="flex flex-wrap items-center gap-[6px] text-[0.86rem] text-[#5c646f] max-[577px]:text-[0.8rem]">
              {hasRating && <StarIcon className="inline-flex shrink-0" />}
              <span>{aggregateRating}</span>
              {totalRatings && <span>{totalRatings}</span>}
              {userHasRated && (
                <span className="rated-note text-[0.76rem] text-[#7a838f] max-[577px]:text-[0.72rem]">
                  Your rating: {mealData.userRating}/10
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-[6px] mt-[2px]">
              <button
                className={cx(
                  SMALL_BTN,
                  "rate-btn self-start bg-[#f3f8e7] text-[#9bb158] border-[#8fab55] hover:bg-[#e8f1d1] hover:border-[#9bb158] hover:text-[#7c9341] active:bg-[#dce9bf] active:text-[#6f8438]"
                )}
                onClick={() => handleRateClick(mealType)}
              >
                {userHasRated ? "Edit" : "Rate"}
              </button>
              <button
                className={cx(
                  SMALL_BTN,
                  "reviews-btn bg-white text-[#5c646f] border-[#9aa3ad] hover:bg-[#f5f6f8] hover:border-[#bfc4cb] hover:text-[#30363d]"
                )}
                onClick={() => setShowRatingModal({ mealType, tab: "reviews" })}
              >
                {commentCount > 0 ? `Reviews (${commentCount})` : "Reviews"}
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const selected = showRatingModal ? meals[showRatingModal.mealType] : null;

  return (
    <>
      <div className={`${CONTAINER} my-6`}>
        <h3 className="text-center text-[1.35rem] max-[561px]:text-[1.15rem]">{currentFormattedDate}</h3>
        <div className={cx("table-container", isActive && "active")}>
          <table
            className="w-full mt-6 mb-12 border-collapse caption-bottom align-top text-[#212529] bg-[#f8f9fa] rounded-[0.375rem] shadow-[0_0.5rem_1rem_rgba(33,37,41,0.15)]"
            id="mainContainer"
          >
            <thead>
              <tr>
                <th scope="col" className={cx(HEAD_CELL, COL_TIME)}>
                  Timings
                </th>
                <th scope="col" className={cx(HEAD_CELL, COL_WIDE)}>
                  Meals
                </th>
                <th scope="col" className={cx(HEAD_CELL, COL_WIDE)}>
                  Menu
                </th>
              </tr>
            </thead>
            <tbody className="align-[inherit]">
              {meals.breakfast && renderMealRow("breakfast", timings.breakfast, meals.breakfast)}
              {meals.lunch && renderMealRow("lunch", timings.lunch, meals.lunch)}
              {meals.dinner && renderMealRow("dinner", timings.dinner, meals.dinner)}
            </tbody>
          </table>
        </div>
        {/* Below the menu, never above it: the menu is what students came for */}
        <Spotlight slot="today" className="-mt-6 mb-10" />
      </div>

      {showRatingModal && selected && (
        <MealRatingModal
          mealName={selected.name || `${day} ${showRatingModal.mealType}`}
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
