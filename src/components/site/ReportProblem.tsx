"use client";

import { isFeedbackConfigured, openFeedback } from "@/lib/site/feedback";

/**
 * One quiet line pointing menu mismatches and bugs to the private feedback
 * form, so they do not end up as public meal reviews.
 */
export default function ReportProblem() {
  if (!isFeedbackConfigured()) return null;
  return (
    <p className="report-problem">
      Menu doesn&apos;t match what&apos;s served, or something not working?{" "}
      <button type="button" className="report-problem-link" onClick={openFeedback}>
        Report it privately
      </button>
    </p>
  );
}
