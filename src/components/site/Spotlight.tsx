"use client";

import { useEffect, useState } from "react";
import SpotlightCard from "@/components/spotlight/SpotlightCard";
import { MAX_VISIBLE, slidesOf, type SpotlightSlot } from "@/components/spotlight/model";
import { apiUrl } from "@/lib/site/api";
import { dismissSpotlight, useSpotlights } from "@/lib/site/spotlight";
import { cx } from "./shellClasses";

const ADVANCE_MS = 8000;

/**
 * A slot for admin-managed sponsored cards: up to two side by side (stacked
 * when narrow). More than two become a slideshow that moves to the next pair
 * every few seconds. Every slide occupies the same grid cell, so the slot is as
 * tall as its tallest slide and the page never shifts when slides change.
 *
 * The slideshow pauses on hover or focus, while the tab is hidden, and with
 * the visible pause button; it never moves for "reduce motion" users.
 */
export default function Spotlight({ slot, className }: { slot: SpotlightSlot; className?: string }) {
  const campaigns = useSpotlights(slot);
  const slides = slidesOf(campaigns);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const count = slides.length;
  const active = count ? index % count : 0;
  const rotating = count > 1 && !hovered && !stopped;

  useEffect(() => {
    if (!rotating || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => i + 1);
    }, ADVANCE_MS);
    return () => clearInterval(timer);
  }, [rotating]);

  if (count === 0) return null;
  const perSlide = Math.min(campaigns.length, MAX_VISIBLE);

  return (
    <section
      className={cx("@container mx-auto", perSlide > 1 ? "max-w-[1140px]" : "max-w-[720px]", className)}
      aria-label="Sponsored"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      <div className="grid">
        {slides.map((slide, i) => (
          <div
            key={slide.map((c) => c.id).join("|") + i}
            className={cx(
              "col-start-1 row-start-1 grid gap-3 transition-opacity duration-500 ease-in-out motion-reduce:transition-none",
              perSlide > 1 && "@min-[640px]:grid-cols-2",
              i === active ? "opacity-100" : "opacity-0 invisible"
            )}
            aria-roledescription={count > 1 ? "slide" : undefined}
            aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
            aria-hidden={i !== active}
            inert={i !== active}
          >
            {slide.map((campaign) => (
              <SpotlightCard
                key={campaign.id}
                campaign={campaign}
                // The backend counts the click and redirects to the advertiser,
                // so tapping, middle-clicking and "open in new tab" all count
                href={apiUrl(`/api/spotlight/go/${encodeURIComponent(campaign.id)}`)}
                onDismiss={() => dismissSpotlight(campaign)}
              />
            ))}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className="grid place-items-center size-6 p-0 bg-transparent border-none rounded-full"
              onClick={() => setIndex(i)}
              aria-label={`Show sponsored ${i + 1} of ${count}`}
              aria-current={i === active}
            >
              <span
                className={cx(
                  "block h-1.5 rounded-full transition-[width,background] duration-300",
                  i === active ? "w-4 bg-[#8b939d]" : "w-1.5 bg-[#c9ced4] hover:bg-[#aab2bc]"
                )}
              />
            </button>
          ))}
          <button
            type="button"
            className="ml-1 grid place-items-center size-6 p-0 bg-transparent border-none rounded-full text-[#8b939d] hover:text-[#24292f] focus-visible:outline-2 focus-visible:outline-[#7c9341]"
            onClick={() => setStopped((s) => !s)}
            aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
            title={stopped ? "Play" : "Pause"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              {stopped ? <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /> : <path d="M3 1.5h2v9H3zM7 1.5h2v9H7z" fill="currentColor" />}
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
