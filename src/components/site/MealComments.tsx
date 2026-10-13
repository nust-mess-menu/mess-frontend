"use client";

import { useEffect, useState } from "react";
import { ANONYMOUS_NAME, getAvatarForId } from "@/lib/site/avatars";
import { COMMENTS_PAGE_SIZE, fetchMealComments, selectMealThread, upvoteComment } from "@/lib/site/commentsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import type { MealComment } from "@/lib/site/types";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

// Phones: max-[577px] matches the original max-width: 576px breakpoint
const reviewsList = "m-0 flex list-none flex-col p-0";
const reviewItem = "flex gap-3 border-t border-[#eceef1] py-3.5 first:border-t-0 first:pt-[2px]";
const avatarBox = "mr-0 h-[34px] w-[34px] shrink-0 select-none max-[577px]:h-[30px] max-[577px]:w-[30px]";
// Stock anonymous avatar - no real profile photos are ever loaded
const reviewAvatar = cx(avatarBox, "rounded-full bg-[#eef0f2] object-cover filter-none");
const reviewBody = "flex min-w-0 flex-1 flex-col gap-[5px]";
const skeleton =
  "block rounded bg-[#eef0f2] bg-[linear-gradient(90deg,#eef0f2_25%,#e3e6e9_37%,#eef0f2_63%)] bg-[length:400%_100%] animate-skeleton-shimmer motion-reduce:animate-none";
const skeletonLine = cx(skeleton, "h-2.5");
const pill = "inline-flex items-center gap-[5px] rounded-[14px] px-2.5 py-[3px] text-[0.74rem] font-semibold max-[577px]:px-3 max-[577px]:py-[5px]";
const stateBox = "rounded-lg border px-4 py-7 text-center";
const stateTitle = "m-0 text-[0.9rem] font-semibold text-[#4d545d]";
const outlineBtn =
  "rounded-md border border-[#d7d9dd] bg-white font-semibold text-[#4d545d] transition-colors duration-150";

/**
 * Reviews list for a single meal: rating summary, then comments sorted by
 * upvotes. Authors appear only under generated usernames with stock avatars -
 * the API sends no real identity at all. All text is rendered as text.
 */
export default function MealComments({
  mealId,
  averageRating,
  ratingCount = 0,
}: {
  mealId: string;
  averageRating: number | null;
  ratingCount?: number;
}) {
  const dispatch = useAppDispatch();
  const thread = useAppSelector((state) => selectMealThread(state, mealId));
  const user = useAppSelector((state) => state.auth.user);
  const { items, total, hasMore, loading, loadingMore, error } = thread;

  useEffect(() => {
    if (mealId) dispatch(fetchMealComments({ mealId, offset: 0, append: false }));
  }, [dispatch, mealId]);

  const handleUpvote = (commentId: string, upvote: boolean) => {
    if (!user) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }
    dispatch(upvoteComment({ mealId, commentId, upvote }));
  };

  return (
    <div className="flex flex-col gap-4" data-testid="reviews">
      <ReviewSummary averageRating={averageRating} ratingCount={ratingCount} commentCount={total} />

      {loading && <ReviewSkeletonList />}

      {!loading && error && (
        <div className={cx(stateBox, "border-solid border-[#e8d2d2] bg-[#fdf7f7]")} role="alert">
          <p className={stateTitle}>{error}</p>
          <button
            type="button"
            className={cx(outlineBtn, "mt-3 px-3.5 py-1.5 text-[0.78rem] hover:bg-[#f5f6f8]")}
            onClick={() => dispatch(fetchMealComments({ mealId, offset: 0, append: false }))}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className={cx(stateBox, "border-dashed border-[#dfe2e6]")}>
          <p className={stateTitle}>No reviews yet</p>
          <p className="mt-1.5 mb-0 text-[0.8rem] text-[#8b939d]">Be the first to tell others what this meal was like.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <ul className={reviewsList}>
            {items.map((comment) => (
              <ReviewItem key={comment.id} comment={comment} onUpvote={handleUpvote} />
            ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              className={cx(
                outlineBtn,
                "self-center px-4 py-[7px] text-[0.78rem] enabled:hover:border-[#bfc4cb] enabled:hover:bg-[#f5f6f8] disabled:cursor-default disabled:opacity-60"
              )}
              onClick={() => dispatch(fetchMealComments({ mealId, offset: items.length, append: true }))}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : `Show ${Math.min(COMMENTS_PAGE_SIZE, total - items.length)} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ReviewSummary({
  averageRating,
  ratingCount,
  commentCount,
}: {
  averageRating: number | null;
  ratingCount: number;
  commentCount: number;
}) {
  const hasRating = typeof averageRating === "number" && averageRating > 0;
  const score = hasRating ? averageRating.toFixed(1) : "—";

  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-[#e4e6ea] bg-[#fafbfc] px-4 py-3.5 max-[577px]:gap-3.5 max-[577px]:px-3.5 max-[577px]:py-3"
      data-testid="reviews-summary"
    >
      <div className="flex shrink-0 items-baseline gap-px">
        <span className="text-[1.75rem] leading-none font-semibold text-[#30363d] tabular-nums max-[577px]:text-[1.5rem]">{score}</span>
        <span className="text-[0.85rem] font-medium text-[#8b939d]">/10</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <RatingMeter value={hasRating ? averageRating : 0} />
        <p className="m-0 text-[0.78rem] text-[#6b737d]">
          {ratingCount > 0 ? `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}` : "No ratings yet"}
          {commentCount > 0 && (
            <>
              <span className="mx-1.5 text-[#b9bfc7]" aria-hidden="true">
                ·
              </span>
              {`${commentCount} written ${commentCount === 1 ? "review" : "reviews"}`}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function RatingMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#e7eaee]" role="img" aria-label={`Average ${value.toFixed(1)} out of 10`}>
      <div
        className="h-full rounded-[3px] bg-[#9bb158] transition-[width] duration-300 ease-[ease] motion-reduce:transition-none"
        style={{ width: `${pct}%` }} />
    </div>
  );
}

function ReviewItem({
  comment,
  onUpvote,
}: {
  comment: MealComment;
  onUpvote: (commentId: string, upvote: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = comment.comment.length > 220;
  const upvotes = comment.upvotes || 0;
  const author = comment.author || ANONYMOUS_NAME;

  return (
    <li className={reviewItem} data-testid="review">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={reviewAvatar} src={getAvatarForId(author)} alt="" loading="lazy" />

      <div className={reviewBody}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="max-w-[55%] truncate text-[0.88rem] font-semibold text-[#30363d] max-[577px]:max-w-[45%]"
            data-testid="review-name"
          >{author}</span>
          {comment.isOwn && (
            <span
              className="rounded border border-[#dbe8bd] bg-[#f3f8e7] px-[5px] py-[1px] text-[0.66rem] font-semibold tracking-[0.03em] text-[#7c9341] uppercase"
              data-testid="review-you"
            >
              You
            </span>
          )}
          <span className="rounded bg-[#f0f2f5] px-1.5 py-[2px] text-[0.72rem] font-semibold text-[#4d545d] tabular-nums">{comment.rating}/10</span>
          <time
            className="ml-auto text-[0.72rem] whitespace-nowrap text-[#8b939d] max-[577px]:ml-0 max-[577px]:w-full"
            dateTime={comment.updatedAt} suppressHydrationWarning>
            {formatRelativeTime(comment.updatedAt)}
          </time>
        </div>

        <p
          className={cx(
            "m-0 text-[0.88rem] leading-[1.55] wrap-anywhere whitespace-pre-line text-[#3d444d] max-[577px]:text-[0.84rem]",
            isLong && !expanded && "line-clamp-4"
          )}
          data-testid="review-text"
        >
          {comment.comment}
        </p>

        {isLong && (
          <button
            type="button"
            className="self-start border-0 bg-transparent p-0 text-[0.76rem] font-semibold text-[#7c9341] hover:underline"
            onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        <div className="mt-[2px] flex items-center gap-2.5">
          {comment.isOwn ? (
            upvotes > 0 && (
              <span className={cx(pill, "bg-[#f4f5f7] text-[#8b939d] tabular-nums")}>
                <UpvoteIcon />
                <span>{upvotes}</span>
              </span>
            )
          ) : (
            <button
              type="button"
              className={cx(
                pill,
                "border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7c9341]",
                comment.hasUpvoted
                  ? "border-[#c4d796] bg-[#f3f8e7] text-[#6f8438]"
                  : "border-[#d7d9dd] bg-white text-[#5c646f] hover:border-[#bfc4cb] hover:bg-[#f5f6f8] hover:text-[#30363d]"
              )}
              data-testid="review-upvote"
              onClick={() => onUpvote(comment.id, !comment.hasUpvoted)}
              aria-pressed={Boolean(comment.hasUpvoted)}
              aria-label={
                comment.hasUpvoted
                  ? `Remove your upvote, ${upvotes} so far`
                  : `Upvote this review, ${upvotes} so far`
              }
            >
              <UpvoteIcon />
              <span className="tabular-nums empty:hidden" data-testid="review-upvote-count">{upvotes > 0 ? upvotes : ""}</span>
              <span>Helpful</span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

const UpvoteIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
    <path d="M8 2.75l5 5.5H10.2v5H5.8v-5H3l5-5.5z" fill="currentColor" />
  </svg>
);

function ReviewSkeletonList() {
  return (
    <ul className={reviewsList} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li className={reviewItem} key={i}>
          <span className={cx(avatarBox, skeleton)} />
          <div className={reviewBody}>
            <span className={cx(skeletonLine, "w-[35%]")} />
            <span className={cx(skeletonLine, "w-full")} />
            <span className={cx(skeletonLine, "w-[70%]")} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  if (absDiff < 60 * 1000) return "just now";
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absDiff >= ms) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(diff / ms), unit);
    }
  }
  return date.toLocaleDateString();
}
