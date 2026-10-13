"use client";

import { useState } from "react";
import { fetchMealComments } from "@/lib/site/commentsSlice";
import { submitMealRating } from "@/lib/site/menuSlice";
import { useAppDispatch } from "@/lib/site/store";

/**
 * Shared submit flow for the Today and Weekly views: submit, show the thank-you
 * dialog, and reload the meal's reviews. The menu itself is patched in place
 * with the exact totals the server returns (see submitMealRating), so no
 * refetch is needed - and a refetch could hit a backend instance whose cache
 * is a few seconds behind.
 */
export function useMealRating() {
  const dispatch = useAppDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const submit = async (mealId: string, rating: number, comment: string, onDone: () => void) => {
    setIsSubmitting(true);
    try {
      await dispatch(submitMealRating({ mealId, rating, comment: comment || undefined })).unwrap();
      onDone();
      setSuccessMessage(comment ? "Thanks! Your rating and review are now live." : "Rating submitted successfully!");
      setShowSuccessModal(true);
      dispatch(fetchMealComments({ mealId, offset: 0, append: false }));
    } catch (error) {
      // Rejections carry a user-facing message; an expired session has
      // already opened the sign-in modal
      alert(String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => setShowSuccessModal(false);
  // Same look as the Bootstrap modal the original app used
  const successModal = showSuccessModal ? (
    <div className="fixed inset-0 z-[1055] overflow-x-hidden overflow-y-auto bg-black/40" tabIndex={-1}>
      <div className="relative m-2 min-[576px]:mx-auto min-[576px]:my-7 min-[576px]:max-w-[500px]">
        <div className="flex w-full flex-col rounded-lg border border-black/[0.175] bg-white bg-clip-padding outline-0">
          <div className="flex shrink-0 items-center rounded-t-[calc(0.5rem-1px)] border-b border-[#dee2e6] p-4">
            <h5 className="m-0 text-xl leading-normal font-medium">Thank you!</h5>
            <button
              type="button"
              className="-m-2 ml-auto box-content h-4 w-4 rounded-md border-0 bg-transparent p-2 text-black opacity-50 hover:opacity-75 focus:opacity-100 focus:shadow-[0_0_0_0.25rem_rgba(13,110,253,0.25)] focus:outline-0"
              aria-label="Close"
              onClick={close}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path
                  d="M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <div className="relative flex-auto p-4">
            <p className="mt-0 mb-4">{successMessage}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end rounded-b-[calc(0.5rem-1px)] border-t border-[#dee2e6] p-3">
            <button
              type="button"
              data-testid="thanks-close"
              className="m-1 rounded-md border border-[#0d6efd] bg-[#0d6efd] px-3 py-1.5 text-base leading-normal text-white transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out hover:border-[#0a58ca] hover:bg-[#0b5ed7] focus-visible:shadow-[0_0_0_0.25rem_rgba(49,132,253,0.5)] focus-visible:outline-0"
              onClick={close}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { isSubmitting, submit, successModal };
}

export const StarIcon = ({ className = "", size = 14 }: { className?: string; size?: number }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path
      d="M12 2.75l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.34l-5.72 3.01 1.09-6.37-4.63-4.51 6.4-.93L12 2.75z"
      fill="currentColor"
    />
  </svg>
);
