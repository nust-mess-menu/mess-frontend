"use client";

import { useEffect, useState } from "react";
import { ANONYMOUS_NAME, getAvatarForId } from "@/lib/site/avatars";
import { COMMENTS_PAGE_SIZE, fetchMealComments, selectMealThread, upvoteComment } from "@/lib/site/commentsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import type { MealComment } from "@/lib/site/types";

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
    <div className="reviews">
      <ReviewSummary averageRating={averageRating} ratingCount={ratingCount} commentCount={total} />

      {loading && <ReviewSkeletonList />}

      {!loading && error && (
        <div className="reviews-state reviews-state--error" role="alert">
          <p className="reviews-state-title">{error}</p>
          <button
            type="button"
            className="reviews-retry"
            onClick={() => dispatch(fetchMealComments({ mealId, offset: 0, append: false }))}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="reviews-state">
          <p className="reviews-state-title">No reviews yet</p>
          <p className="reviews-state-text">Be the first to tell others what this meal was like.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <ul className="reviews-list">
            {items.map((comment) => (
              <ReviewItem key={comment.id} comment={comment} onUpvote={handleUpvote} />
            ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              className="reviews-more"
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
    <div className="reviews-summary">
      <div className="reviews-score">
        <span className="reviews-score-value">{score}</span>
        <span className="reviews-score-scale">/10</span>
      </div>
      <div className="reviews-summary-detail">
        <RatingMeter value={hasRating ? averageRating : 0} />
        <p className="reviews-summary-meta">
          {ratingCount > 0 ? `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}` : "No ratings yet"}
          {commentCount > 0 && (
            <>
              <span className="reviews-dot" aria-hidden="true">
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
    <div className="rating-meter" role="img" aria-label={`Average ${value.toFixed(1)} out of 10`}>
      <div className="rating-meter-fill" style={{ width: `${pct}%` }} />
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
    <li className="review">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="review-avatar" src={getAvatarForId(author)} alt="" loading="lazy" />

      <div className="review-body">
        <div className="review-head">
          <span className="review-name">{author}</span>
          {comment.isOwn && <span className="review-you">You</span>}
          <span className="review-rating">{comment.rating}/10</span>
          <time className="review-time" dateTime={comment.updatedAt} suppressHydrationWarning>
            {formatRelativeTime(comment.updatedAt)}
          </time>
        </div>

        <p className={`review-text ${isLong && !expanded ? "is-clamped" : ""}`}>{comment.comment}</p>

        {isLong && (
          <button type="button" className="review-toggle" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        <div className="review-foot">
          {comment.isOwn ? (
            upvotes > 0 && (
              <span className="review-upvote-static">
                <UpvoteIcon />
                <span>{upvotes}</span>
              </span>
            )
          ) : (
            <button
              type="button"
              className={`review-upvote ${comment.hasUpvoted ? "is-active" : ""}`}
              onClick={() => onUpvote(comment.id, !comment.hasUpvoted)}
              aria-pressed={Boolean(comment.hasUpvoted)}
              aria-label={
                comment.hasUpvoted
                  ? `Remove your upvote, ${upvotes} so far`
                  : `Upvote this review, ${upvotes} so far`
              }
            >
              <UpvoteIcon />
              <span className="review-upvote-count">{upvotes > 0 ? upvotes : ""}</span>
              <span className="review-upvote-label">Helpful</span>
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
    <ul className="reviews-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li className="review" key={i}>
          <span className="review-avatar skeleton-block" />
          <div className="review-body">
            <span className="skeleton-line skeleton-line--short" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line--mid" />
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
