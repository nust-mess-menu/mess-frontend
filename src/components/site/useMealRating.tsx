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

  const successModal = showSuccessModal ? (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Thank you!</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowSuccessModal(false)} />
          </div>
          <div className="modal-body">
            <p>{successMessage}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={() => setShowSuccessModal(false)}>
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
