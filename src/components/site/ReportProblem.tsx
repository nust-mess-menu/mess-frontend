"use client";

import { isFeedbackConfigured, openFeedback } from "@/lib/site/feedback";

/**
 * One quiet line pointing menu mismatches and bugs to the private feedback
 * form, so they do not end up as public meal reviews.
 */
export default function ReportProblem() {
  if (!isFeedbackConfigured()) return null;
  return (
    <p className="max-w-[720px] mx-auto mt-0 mb-1 px-4 text-center text-[0.82rem] text-[#6c757d]">
      Menu doesn&apos;t match what&apos;s served, or something not working?{" "}
      <button type="button" className="p-0 border-0 bg-transparent text-[length:inherit] font-semibold text-[#7c9341] underline underline-offset-2 hover:text-[#5f7330] focus-visible:text-[#5f7330]" onClick={openFeedback}>
        Report it privately
      </button>
    </p>
  );
}
