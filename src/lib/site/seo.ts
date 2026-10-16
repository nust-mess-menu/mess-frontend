import type { Metadata } from "next";

/** Search and social metadata for the student pages. */

export const SITE_URL = "https://nustmessmenu.oddmancy.com";
export const SITE_NAME = "NUST Mess Menu";

const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "NUST Mess Menu" };

/**
 * Title, description, canonical URL and the matching Open Graph / Twitter
 * card for one page. Next.js replaces nested metadata objects per segment
 * instead of merging them, so every page sets the full set.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PK",
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

/** WebSite structured data: gives Google the site name shown above results. */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: ["NUST Mess", "Mess Menu NUST", "NUST Hostel Mess Menu"],
  url: `${SITE_URL}/`,
  inLanguage: "en",
  description: "Daily and weekly mess menu for NUST hostels, with meal timings, ratings and reviews.",
};
