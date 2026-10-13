"use client";

import { useState, useSyncExternalStore } from "react";
import { getItem, setItem } from "@/lib/site/storage";
import { cx, POPUP_OVERLAY } from "./shellClasses";

const ARROW =
  "absolute z-10 shrink-0 flex items-center justify-center w-10 h-10 bg-[#535151] text-white border-none text-[20px] transition-all duration-300 ease-[ease] hover:bg-[#3a3939] active:scale-95 max-[769px]:w-9 max-[769px]:h-9 max-[769px]:text-[18px] max-[481px]:w-[30px] max-[481px]:h-[30px] max-[481px]:text-[16px] max-[361px]:w-[26px] max-[361px]:h-[26px] max-[361px]:text-[14px]";

const IMAGES = [
  { src: "/images/feedback-icon.png", alt: "Feedback Icon" },
  { src: "/images/feedback-form.png", alt: "Feedback Form" },
];

// Shown until this date, once per browser
const END_DATE = new Date("2025-11-08T23:59:59");

const noopSubscribe = () => () => undefined;

/** Whether the popup is due, evaluated only in the browser (false during SSR). */
function useAnnouncementDue(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new Date() <= END_DATE && !getItem("announcementDismissed"),
    () => false
  );
}

export default function AnnouncementPopup() {
  const due = useAnnouncementDue();
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const showPopup = due && !dismissed;

  const handleDismiss = () => {
    setItem("announcementDismissed", "true");
    setItem("announcementDismissedDate", Date.now().toString());
    setDismissed(true);
  };

  if (!showPopup) return null;

  const next = () => setIndex((i) => (i === IMAGES.length - 1 ? 0 : i + 1));
  const prev = () => setIndex((i) => (i === 0 ? IMAGES.length - 1 : i - 1));

  return (
    <div className={POPUP_OVERLAY}>
      <div className="relative bg-white border-2 border-[#535151] p-[30px] max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.3)] animate-popup-rise max-[769px]:px-[15px] max-[769px]:py-[25px] max-[769px]:w-[92%] max-[769px]:max-h-[85vh] max-[481px]:px-3 max-[481px]:py-5 max-[481px]:w-[95%] max-[481px]:max-h-[80vh] max-[481px]:border" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="mt-0 mb-[15px] text-[24px] text-center text-[#535151] max-[769px]:text-[22px] max-[769px]:mb-3 max-[481px]:text-[18px] max-[481px]:mb-[10px]">You can now report menu mismatches!</h2>
        <p className="mt-0 mb-5 text-[16px] leading-[1.6] text-center text-[#535151] max-[769px]:text-[15px] max-[769px]:leading-[1.5] max-[769px]:mb-[15px] max-[481px]:text-[13px] max-[481px]:leading-[1.4] max-[481px]:mb-3">
          If the meal you received doesn&apos;t match what&apos;s shown on the menu, use the feedback icon at the
          bottom left to let us know.
        </p>
        <div className="relative flex items-center justify-center gap-[5px] my-5 max-[481px]:gap-[3px] max-[481px]:my-[15px]">
          <button className={`${ARROW} left-0`} onClick={prev} aria-label="Previous image">
            ←
          </button>
          <div className="flex justify-center items-center w-full max-w-[500px] h-[300px] overflow-hidden border-2 border-[#535151] max-[769px]:h-[250px] max-[769px]:max-w-[450px] max-[481px]:h-[180px] max-[481px]:border max-[361px]:h-[150px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="max-w-full max-h-full object-contain filter-none" src={IMAGES[index].src} alt={IMAGES[index].alt} />
          </div>
          <button className={`${ARROW} right-0`} onClick={next} aria-label="Next image">
            →
          </button>
        </div>
        <div className="flex justify-center gap-2 my-[15px] max-[481px]:gap-[6px] max-[481px]:my-3">
          {IMAGES.map((image, i) => (
            <button
              key={image.src}
              className={cx(
                "w-[10px] h-[10px] p-0 border-0 transition-all duration-300 ease-[ease] hover:bg-[#535151] max-[481px]:w-2 max-[481px]:h-2",
                i === index ? "bg-[#535151]" : "bg-[#979ea1]"
              )}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-[10px] mt-5 max-[481px]:mt-[15px]">
          <button
            className="px-[30px] py-3 bg-[#535151] text-white border-none text-[16px] transition-all duration-300 ease-[ease] hover:bg-[#3a3939] hover:-translate-y-[2px] active:translate-y-0 max-[769px]:px-[26px] max-[769px]:py-[11px] max-[769px]:text-[15px] max-[481px]:px-[22px] max-[481px]:py-[10px] max-[481px]:text-[14px] max-[361px]:px-[18px] max-[361px]:py-[9px] max-[361px]:text-[13px]"
            onClick={handleDismiss}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
