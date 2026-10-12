"use client";

import { useState, useSyncExternalStore } from "react";
import { getItem, setItem } from "@/lib/site/storage";

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
    <div className="mm-popup-overlay">
      <div className="mm-announce" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="mm-announce-header">You can now report menu mismatches!</h2>
        <p className="mm-announce-message">
          If the meal you received doesn&apos;t match what&apos;s shown on the menu, use the feedback icon at the
          bottom left to let us know.
        </p>
        <div className="mm-carousel">
          <button className="mm-arrow mm-arrow--left" onClick={prev} aria-label="Previous image">
            ←
          </button>
          <div className="mm-carousel-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mm-carousel-image" src={IMAGES[index].src} alt={IMAGES[index].alt} />
          </div>
          <button className="mm-arrow mm-arrow--right" onClick={next} aria-label="Next image">
            →
          </button>
        </div>
        <div className="mm-dots">
          {IMAGES.map((image, i) => (
            <button
              key={image.src}
              className={`mm-dot ${i === index ? "is-active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
            />
          ))}
        </div>
        <div className="mm-announce-actions">
          <button className="mm-announce-btn" onClick={handleDismiss}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
