"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchTodayMenu } from "@/lib/site/menuSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import type { DaySlots, MealType, MealWithRating } from "@/lib/site/types";
import MealRatingModal from "./MealRatingModal";
import { StarIcon, useMealRating } from "./useMealRating";

export default function TodayContainer({ meals, day }: { meals: DaySlots; weekNumber: number; day: string }) {
  const [isActive, setIsActive] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState<{ mealType: MealType; tab: "rate" | "reviews" } | null>(null);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { isSubmitting, submit, successModal } = useMealRating(() => dispatch(fetchTodayMenu(true)));

  const currentDate = new Date();
  const currentFormattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayOfWeek = currentDate.getDay();
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

    return (
      <tr key={mealType}>
        <td>{timing}</td>
        <td>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</td>
        <td>
          <div className="meal-info">
            {title && <div className="meal-title">{title}</div>}
            <div className="meal-items">{itemNames}</div>
            <div className="meal-rating">
              {hasRating && <StarIcon className="icon-inline" />}
              <span>{aggregateRating}</span>
              {totalRatings && <span>{totalRatings}</span>}
              {userHasRated && <span className="rated-note">Your rating: {mealData.userRating}/10</span>}
            </div>
            <div className="meal-actions">
              <button className="rate-btn" onClick={() => handleRateClick(mealType)}>
                {userHasRated ? "Edit rating" : "Rate"}
              </button>
              <button className="reviews-btn" onClick={() => setShowRatingModal({ mealType, tab: "reviews" })}>
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
      <div className="container my-4">
        <h3 style={{ textAlign: "center" }}>{currentFormattedDate}</h3>
        <div className={`table-container ${isActive ? "active" : ""}`}>
          <table className="container my-4 table table-hover shadow p-3 mb-5 bg-body-tertiary rounded" id="mainContainer">
            <thead>
              <tr className="table-active">
                <th scope="col">Timings</th>
                <th scope="col">Meals</th>
                <th scope="col">Menu</th>
              </tr>
            </thead>
            <tbody>
              {meals.breakfast && renderMealRow("breakfast", timings.breakfast, meals.breakfast)}
              {meals.lunch && renderMealRow("lunch", timings.lunch, meals.lunch)}
              {meals.dinner && renderMealRow("dinner", timings.dinner, meals.dinner)}
            </tbody>
          </table>
        </div>
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
