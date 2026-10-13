"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { getAvatarForId } from "@/lib/site/avatars";
import { isFeedbackConfigured, openFeedback } from "@/lib/site/feedback";
import { useAppSelector } from "@/lib/site/store";
import MealComments from "./MealComments";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

// Phones: max-[577px] matches the original max-width: 576px breakpoint
const btnBase = "py-2 text-[0.85rem] font-semibold rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-default";
const btnPrimaryOlive = cx(
  btnBase,
  "px-[18px] text-white bg-[#9bb158] border border-[#8ba24a] enabled:hover:bg-[#8ba24a]"
);
const btnGhost = cx(
  btnBase,
  "px-4 text-[#4d545d] bg-white border border-[#d7d9dd] enabled:hover:bg-[#f5f6f8] enabled:hover:border-[#bfc4cb]"
);
const stripBar = "border-t border-[#e6e8ec] bg-[#fafbfc]";
const rateLabel = "p-0 text-[0.85rem] font-semibold text-[#30363d]";

const MAX_COMMENT_LENGTH = 500;

const SCORE_LABELS: Record<number, string> = {
  1: "Terrible",
  2: "Bad",
  3: "Poor",
  4: "Below average",
  5: "Average",
  6: "Fair",
  7: "Good",
  8: "Very good",
  9: "Excellent",
  10: "Outstanding",
};

export interface MealRatingModalProps {
  mealName: string;
  items?: string[];
  mealId: string;
  currentRating: number | null;
  averageRating?: number | null;
  ratingCount?: number;
  commentCount?: number;
  initialTab?: "rate" | "reviews";
  canRate?: boolean;
  onRequestLogin: () => void;
  onSubmit: (mealId: string, rating: number, comment: string) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

/** Meal rating + reviews dialog: "Rate" (sign-in required) and "Reviews" (public). */
export default function MealRatingModal({
  mealName,
  items = [],
  mealId,
  currentRating,
  averageRating = null,
  ratingCount = 0,
  commentCount = 0,
  initialTab = "rate",
  canRate = true,
  onRequestLogin,
  onSubmit,
  onClose,
  isSubmitting,
}: MealRatingModalProps) {
  const [tab, setTab] = useState(initialTab);
  const [rating, setRating] = useState(currentRating || 0);
  const [comment, setComment] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [showWhyAnonymous, setShowWhyAnonymous] = useState(false);
  const [confirmNoComment, setConfirmNoComment] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const username = useAppSelector((state) => state.auth.user?.username);

  // Escape closes; background scrolling is locked while open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, isSubmitting]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    },
    [onClose, isSubmitting]
  );

  const submit = () => {
    setConfirmNoComment(false);
    onSubmit(mealId, rating, comment.trim());
  };

  const handleSubmit = (event?: FormEvent | MouseEvent) => {
    event?.preventDefault();
    if (rating === 0) {
      setValidationError("Select a score from 1 to 10 before submitting.");
      return;
    }
    setValidationError("");
    // Ask once for a note rather than blocking - a bare score still counts
    if (comment.trim().length === 0) {
      setConfirmNoComment(true);
      return;
    }
    submit();
  };

  const activeScore = hoveredRating || rating;
  const hasRatedBefore = typeof currentRating === "number" && currentRating > 0;

  return (
    <div
      className="fixed inset-0 z-[1080] flex items-center justify-center bg-[rgba(24,28,33,0.45)] p-4 animate-meal-fade motion-reduce:animate-none max-[577px]:items-end max-[577px]:p-0"
      onClick={handleBackdropClick} role="presentation">
      <div
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_12px_32px_rgba(20,24,30,0.18)] outline-none animate-meal-rise motion-reduce:animate-none max-[577px]:max-h-[92vh] max-[577px]:max-w-full max-[577px]:rounded-[12px_12px_0_0]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-modal-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-[18px] pb-3 max-[577px]:px-4 max-[577px]:pt-4 max-[577px]:pb-2.5">
          <div>
            <p className="m-0 mb-[2px] text-[0.68rem] font-semibold tracking-[0.06em] text-[#9aa2ac] uppercase">Meal reviews</p>
            <h2 className="m-0 text-[1.12rem] leading-[1.3] font-semibold text-[#24292f] capitalize" id="meal-modal-title">
              {mealName}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-[#6b737d] transition-colors duration-150 enabled:hover:bg-[#f2f3f5] enabled:hover:text-[#24292f] disabled:cursor-default disabled:opacity-50"
            onClick={onClose} disabled={isSubmitting} aria-label="Close">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-3.5 max-[577px]:px-4">
            {items.map((item, index) => (
              <span
                className="rounded border border-[#e6e8ec] bg-[#f4f5f7] px-2 py-[3px] text-[0.76rem] font-medium text-[#4d545d]"
                key={`${item}-${index}`}>
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-6 border-b border-[#e6e8ec] px-5 max-[577px]:px-4" role="tablist" aria-label="Meal review sections">
          <button
            type="button"
            role="tab"
            id="tab-rate"
            aria-selected={tab === "rate"}
            aria-controls="panel-rate"
            className={tabClass(tab === "rate")}
            onClick={() => setTab("rate")}
          >
            {hasRatedBefore ? "Your rating" : "Rate"}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-reviews"
            aria-selected={tab === "reviews"}
            aria-controls="panel-reviews"
            className={tabClass(tab === "reviews")}
            onClick={() => setTab("reviews")}
          >
            Reviews
            {commentCount > 0 && (
              <span
                className={cx(
                  "rounded-[9px] px-1.5 py-[1px] text-[0.68rem] font-semibold tabular-nums",
                  tab === "reviews" ? "bg-[#f0f6e2] text-[#6f8438]" : "bg-[#eef0f3] text-[#5f6873]"
                )}
              >
                {commentCount}
              </span>
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px] max-[577px]:p-4">
          {tab === "rate" ? (
            <div role="tabpanel" id="panel-rate" aria-labelledby="tab-rate">
              {canRate ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className={cx(rateLabel, "mb-2")}>How would you rate this meal?</legend>

                    <div className="grid grid-cols-10 gap-1 max-[577px]:grid-cols-5 max-[577px]:gap-1.5" onMouseLeave={() => setHoveredRating(0)}>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                        <button
                          type="button"
                          key={score}
                          className={cx(
                            "h-[38px] rounded-[5px] border text-[0.82rem] font-semibold tabular-nums transition-colors duration-[120ms]",
                            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7c9341]",
                            "enabled:hover:border-[#9bb158] disabled:cursor-default disabled:opacity-55",
                            "max-[577px]:h-[42px] max-[577px]:text-[0.88rem]",
                            score === rating
                              ? "border-[#8ba24a] bg-[#9bb158] text-white"
                              : score <= activeScore
                                ? "border-[#c4d796] bg-[#f0f6e2] text-[#6f8438]"
                                : "border-[#d9dce1] bg-white text-[#5f6873]"
                          )}
                          onClick={() => {
                            setRating(score);
                            setValidationError("");
                          }}
                          onMouseEnter={() => setHoveredRating(score)}
                          onFocus={() => setHoveredRating(score)}
                          onBlur={() => setHoveredRating(0)}
                          disabled={isSubmitting}
                          aria-pressed={score === rating}
                          aria-label={`${score} out of 10`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>

                    <div className="flex min-h-5 items-baseline gap-2 text-[0.82rem] text-[#30363d]">
                      {activeScore > 0 ? (
                        <>
                          <strong>{activeScore}/10</strong>
                          <span className="text-[#6b737d]">{SCORE_LABELS[activeScore]}</span>
                        </>
                      ) : (
                        <span className="text-[#9aa2ac]">Pick a score from 1 (terrible) to 10 (outstanding)</span>
                      )}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-2">
                    <label className={rateLabel} htmlFor="mealComment">
                      Add a review <span className="font-normal text-[#9aa2ac]">(optional)</span>
                    </label>

                    {username && (
                      <div className="flex items-center gap-2 text-[0.78rem] text-[#6b737d]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="mr-0 h-[22px] w-[22px] shrink-0 rounded-full object-cover filter-none" src={getAvatarForId(username)} alt="" />
                        <span>
                          Posting as <strong className="font-semibold text-[#30363d]">{username}</strong>
                        </span>
                        <button
                          type="button"
                          className="ml-auto border-0 bg-transparent p-0 text-[0.74rem] font-semibold whitespace-nowrap text-[#7c9341] hover:underline"
                          onClick={() => setShowWhyAnonymous((prev) => !prev)}
                          aria-expanded={showWhyAnonymous}
                        >
                          {showWhyAnonymous ? "Got it" : "Why?"}
                        </button>
                      </div>
                    )}

                    {username && showWhyAnonymous && (
                      <p className="m-0 rounded-md border border-[#e4ebd4] bg-[#f7f9f2] px-[11px] py-[9px] text-[0.76rem] leading-normal text-[#5f6873]">
                        Reviews are anonymous. Everyone sees <strong className="text-[#6f8438]">{username}</strong> — never your name, email or
                        photo. The name is picked at random, means nothing about you, and stays yours.
                      </p>
                    )}

                    <textarea
                      id="mealComment"
                      ref={commentRef}
                      className="min-h-[92px] w-full resize-y rounded-md border border-[#d9dce1] bg-white px-3 py-2.5 font-[inherit] text-[0.88rem] leading-[1.55] text-[#30363d] transition-[border-color,box-shadow] duration-150 placeholder:text-[#a8afb8] focus:border-[#9bb158] focus:shadow-[0_0_0_3px_rgba(155,177,88,0.15)] focus:outline-none disabled:cursor-default disabled:bg-[#f7f8f9]"
                      rows={4}
                      maxLength={MAX_COMMENT_LENGTH}
                      placeholder="What was good? What could be better? Your review is shown anonymously."
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.74rem] text-[#9aa2ac]">Public, about the food. Visible to everyone using the menu.</span>
                      <span
                        className={cx(
                          "text-[0.74rem] tabular-nums",
                          comment.length > MAX_COMMENT_LENGTH - 50 ? "text-[#b4783c]" : "text-[#9aa2ac]"
                        )}
                      >
                        {comment.length}/{MAX_COMMENT_LENGTH}
                      </span>
                    </div>
                  </div>

                  {isFeedbackConfigured() && (
                    <p className="mt-1.5 mb-0 text-[12px] text-[#6c757d]">
                      Wrong menu or something broken?{" "}
                      <button
                        type="button"
                        className="border-0 bg-transparent p-0 text-[length:inherit] font-semibold text-[#6f8a2e] underline underline-offset-2 hover:text-[#4f6420]"
                        onClick={() => {
                          onClose();
                          openFeedback();
                        }}
                      >
                        Report it privately
                      </button>{" "}
                      instead.
                    </p>
                  )}

                  {validationError && (
                    <p className="m-0 text-[0.8rem] text-[#b23b3b]" role="alert">
                      {validationError}
                    </p>
                  )}
                </form>
              ) : (
                <div className="rounded-lg border border-dashed border-[#dfe2e6] px-4 py-6 text-center">
                  <p className="m-0 text-[0.92rem] font-semibold text-[#30363d]">Sign in to rate this meal</p>
                  <p className="mx-auto mt-1.5 mb-3.5 max-w-[340px] text-[0.8rem] leading-normal text-[#8b939d]">
                    You can read every review without an account, but rating needs one so each person counts once.
                  </p>
                  <button type="button" className={btnPrimaryOlive} onClick={onRequestLogin}>
                    Sign in
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews">
              <MealComments mealId={mealId} averageRating={averageRating} ratingCount={ratingCount} />
            </div>
          )}
        </div>

        {confirmNoComment && (
          <div
            className={cx(
              stripBar,
              "flex flex-wrap items-center justify-between gap-3.5 px-5 py-3.5",
              "max-[577px]:flex-col max-[577px]:items-stretch max-[577px]:gap-3 max-[577px]:px-4 max-[577px]:py-3"
            )}
            role="group" aria-label="Submit without a review">
            <div className="min-w-0">
              <p className="m-0 text-[0.88rem] font-semibold text-[#30363d]">Add a quick note?</p>
              <p className="mt-[2px] mb-0 text-[0.78rem] text-[#8b939d]">
                {rating <= 4
                  ? "A score says it was bad. One line says what to fix."
                  : "A score says it was good. One line says what to keep."}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 max-[577px]:w-full">
              <button type="button" className={cx(btnGhost, "max-[577px]:flex-1")} onClick={submit} disabled={isSubmitting}>
                Just the rating
              </button>
              <button
                type="button"
                className={cx(btnPrimaryOlive, "max-[577px]:flex-1")}
                onClick={() => {
                  setConfirmNoComment(false);
                  commentRef.current?.focus();
                }}
                disabled={isSubmitting}
              >
                Write a line
              </button>
            </div>
          </div>
        )}

        {tab === "rate" && canRate && !confirmNoComment && (
          <footer className={cx(stripBar, "flex justify-end gap-2 px-5 py-3.5 max-[577px]:px-4 max-[577px]:py-3")}>
            <button type="button" className={cx(btnGhost, "max-[577px]:flex-1")} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className={cx(btnPrimaryOlive, "max-[577px]:flex-1")}
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting ? "Submitting…" : hasRatedBefore ? "Update rating" : "Submit rating"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function tabClass(active: boolean): string {
  return cx(
    "relative flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-0 py-2.5 text-[0.85rem] font-semibold transition-colors duration-150",
    active ? "border-b-[#9bb158] text-[#24292f]" : "border-b-transparent text-[#6b737d] hover:text-[#30363d]"
  );
}
