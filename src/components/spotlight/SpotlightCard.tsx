import { textOn, type Spotlight } from "./model";

type CardContent = Pick<Spotlight, "advertiser" | "headline" | "body" | "ctaLabel" | "accent" | "logo" | "snoozeDays">;

/**
 * A sponsored card that sits in the page flow like a day card: never a popup,
 * never sticky. Clearly labelled "Sponsored". Shared by the student site and
 * the admin preview, so it uses only Tailwind utilities. It lays itself out by
 * its own width (container queries), so it works alone or two side by side.
 */
export default function SpotlightCard({
  campaign,
  href,
  onDismiss,
}: {
  campaign: CardContent;
  href: string;
  onDismiss?: () => void;
}) {
  const { advertiser, headline, body, ctaLabel, accent, logo, snoozeDays } = campaign;
  const ink = textOn(accent);
  const hideLabel = `Hide for ${snoozeDays} day${snoozeDays === 1 ? "" : "s"}`;

  return (
    <aside
      className="spotlight-card @container relative w-full h-full overflow-hidden bg-white border border-[#d7d9dd] rounded-[8px] text-left shadow-[0_1px_3px_rgba(20,24,30,0.06)] animate-popup-fade motion-reduce:animate-none"
      aria-label={`Sponsored: ${advertiser}`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} aria-hidden="true" />
      <div className="flex h-full items-center gap-4 py-[14px] pl-5 pr-12 @max-[480px]:flex-wrap @max-[480px]:gap-3 @max-[480px]:pl-4 @max-[480px]:pr-10">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="shrink-0 size-11 m-0 rounded-[10px] object-contain filter-none" src={logo} alt="" width={44} height={44} />
        ) : (
          <span
            className="shrink-0 grid place-items-center size-11 rounded-[10px] text-[1.1rem] font-bold"
            style={{ background: accent, color: ink }}
            aria-hidden="true"
          >
            {advertiser.trim().charAt(0).toUpperCase() || "•"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[#8b939d]">
            Sponsored{advertiser && <span className="font-semibold normal-case tracking-normal"> · {advertiser}</span>}
          </p>
          <p className="m-0 mt-[2px] text-[0.98rem] font-semibold leading-[1.35] text-[#24292f] @max-[480px]:text-[0.93rem]">{headline}</p>
          {body && <p className="m-0 mt-[2px] text-[0.84rem] leading-[1.45] text-[#5c646f] @max-[480px]:text-[0.8rem]">{body}</p>}
        </div>
        <a
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-[14px] py-2 rounded-[6px] text-[0.82rem] font-semibold no-underline whitespace-nowrap transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24292f] @max-[480px]:w-full"
          style={{ background: accent, color: ink }}
          href={href}
          target="_blank"
          rel="sponsored noopener"
        >
          {ctaLabel}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="absolute top-2 right-2 grid place-items-center size-7 p-0 rounded-full bg-transparent border-none text-[1.1rem] leading-none text-[#8b939d] transition-[background,color] duration-150 hover:bg-[#f1f3f5] hover:text-[#24292f] focus-visible:outline-2 focus-visible:outline-[#7c9341]"
          onClick={onDismiss}
          aria-label={hideLabel}
          title={hideLabel}
        >
          ×
        </button>
      )}
    </aside>
  );
}
