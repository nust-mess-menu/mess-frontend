/**
 * Spotlight: admin-managed sponsored cards on the student site. Shared by the
 * student card and the admin console's live preview, so this module is pure
 * (no browser APIs).
 *
 * "Spotlight" rather than "ad" in code, paths and class names on purpose: ad
 * blockers hide anything named ad/ads/advert/sponsor/banner. Students still
 * see a "Sponsored" label.
 */

export const SPOTLIGHT_SLOTS = ["today", "week"] as const;
export type SpotlightSlot = (typeof SPOTLIGHT_SLOTS)[number];

export const SLOT_LABELS: Record<SpotlightSlot, string> = {
  today: "Today page, below the menu",
  week: "This Week page, below the days",
};

/** What students receive from GET /api/v2/spotlight. */
export interface Spotlight {
  id: string;
  advertiser: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  accent: string;
  logo: string | null;
  slots: SpotlightSlot[];
  startsAt: string;
  endsAt: string | null;
  weight: number;
  snoozeDays: number;
}

/**
 * Bundled logos ship with the site (public/images/spotlight). Admins can also
 * upload one, stored as a small raster data URI. Either way the CSP stays
 * closed to third-party images.
 */
export const SPOTLIGHT_LOGOS: { path: string; label: string }[] = [
  { path: "/images/spotlight/guerillafyp.svg", label: "Guerilla FYP" },
  { path: "/images/spotlight/rahgeer.png", label: "Rahgeer" },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const MAX_LOGO_LENGTH = 60_000;
const BUNDLED_LOGO = /^\/images\/spotlight\/[a-z0-9][a-z0-9-]{0,60}\.(png|svg|webp|jpg)$/;
const UPLOADED_LOGO = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

export const isUploadedLogo = (logo: string | null): logo is string => Boolean(logo && UPLOADED_LOGO.test(logo));
const isLogo = (logo: string) => logo.length <= MAX_LOGO_LENGTH && (BUNDLED_LOGO.test(logo) || UPLOADED_LOGO.test(logo));
const DAY_MS = 24 * 60 * 60 * 1000;

/** Keep only well-formed campaigns: cached or fetched data is never trusted blindly. */
export function sanitizeSpotlights(input: unknown): Spotlight[] {
  if (!Array.isArray(input)) return [];
  const out: Spotlight[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" ? v : "");
    const ctaUrl = text(c.ctaUrl);
    if (typeof c.id !== "string" || !text(c.headline) || !text(c.ctaLabel) || !ctaUrl.startsWith("https://")) continue;
    out.push({
      id: c.id,
      advertiser: text(c.advertiser),
      headline: text(c.headline),
      body: text(c.body),
      ctaLabel: text(c.ctaLabel),
      ctaUrl,
      accent: HEX.test(text(c.accent)) ? text(c.accent) : "#9bb158",
      logo: typeof c.logo === "string" && isLogo(c.logo) ? c.logo : null,
      slots: Array.isArray(c.slots) ? c.slots.filter((s): s is SpotlightSlot => (SPOTLIGHT_SLOTS as readonly unknown[]).includes(s)) : [],
      startsAt: text(c.startsAt),
      endsAt: typeof c.endsAt === "string" ? c.endsAt : null,
      weight: typeof c.weight === "number" && c.weight >= 1 ? Math.min(10, Math.round(c.weight)) : 1,
      snoozeDays: typeof c.snoozeDays === "number" && c.snoozeDays >= 1 ? Math.min(90, Math.round(c.snoozeDays)) : 7,
    });
  }
  return out;
}

export function isInWindow(c: Pick<Spotlight, "startsAt" | "endsAt">, now: number): boolean {
  const start = Date.parse(c.startsAt);
  const end = c.endsAt ? Date.parse(c.endsAt) : Infinity;
  return !Number.isNaN(start) && start <= now && now < end;
}

/** When a dismissal of this campaign runs out. */
export function snoozeUntil(c: Pick<Spotlight, "snoozeDays">, now: number): number {
  return now + c.snoozeDays * DAY_MS;
}

/** At most this many cards are visible in a slot at once; more rotate as a slideshow. */
export const MAX_VISIBLE = 2;

function hash(text: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A deterministic number in [0, 1) for this campaign on this page view. */
function unitFor(id: string, seed: number): number {
  let t = (hash(id) ^ Math.floor(seed * 2 ** 32)) + 0x6d2b79f5; // one mulberry32 step
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
}

/**
 * Every campaign eligible for a slot, in display order. The order is a
 * weighted shuffle (weight 2 is twice as likely as weight 1 to come first),
 * fixed by `seed` (0..1, one per page view) so it is stable across re-renders.
 */
export function orderSpotlights(
  campaigns: Spotlight[],
  slot: SpotlightSlot,
  now: number,
  dismissed: Record<string, number>,
  seed: number
): Spotlight[] {
  return campaigns
    .filter((c) => c.slots.includes(slot) && isInWindow(c, now) && !((dismissed[c.id] ?? 0) > now))
    .map((c) => ({ c, key: unitFor(c.id, seed) ** (1 / c.weight) }))
    .sort((a, b) => b.key - a.key || (a.c.id < b.c.id ? -1 : 1))
    .map(({ c }) => c);
}

/**
 * Split campaigns into slides of up to MAX_VISIBLE. When they don't divide
 * evenly the slides wrap around (a,b | c,a | b,c), so every campaign gets the
 * same screen time and no slide is half empty.
 */
export function slidesOf(campaigns: Spotlight[]): Spotlight[][] {
  const n = campaigns.length;
  if (n <= MAX_VISIBLE) return n ? [campaigns] : [];
  const count = n % MAX_VISIBLE === 0 ? n / MAX_VISIBLE : n;
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length: MAX_VISIBLE }, (_, j) => campaigns[(i * MAX_VISIBLE + j) % n])
  );
}

/** The CTA link with UTM tags, so the advertiser can see visits came from here. Existing tags win. */
export function trackedUrl(c: Pick<Spotlight, "id" | "ctaUrl">): string {
  try {
    const url = new URL(c.ctaUrl);
    const tags = { utm_source: "messmenu", utm_medium: "spotlight", utm_campaign: c.id };
    for (const [k, v] of Object.entries(tags)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return c.ctaUrl;
  }
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white text, whichever reads better on the accent colour (WCAG contrast). */
export function textOn(accent: string): "#111111" | "#ffffff" {
  if (!HEX.test(accent)) return "#ffffff";
  const l = luminance(accent);
  const onBlack = (l + 0.05) / (luminance("#111111") + 0.05);
  const onWhite = 1.05 / (l + 0.05);
  return onBlack >= onWhite ? "#111111" : "#ffffff";
}
