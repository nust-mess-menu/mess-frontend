import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { preconnect } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/site/Providers";
import { SITE_NAME, SITE_URL } from "@/lib/site/seo";

import "@/styles/site.css";

// Self-hosted at build time: no request to Google Fonts from the browser.
// Regular weight only, exactly like the original's Google Fonts link.
const inter = Inter({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  // Absolute canonical and Open Graph URLs, so links from the old addresses
  // consolidate here. Each page sets its own title, canonical and card
  // (src/lib/site/seo.ts).
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: "Daily and weekly mess menu for NUST hostels, with meal timings, ratings and reviews.",
  applicationName: SITE_NAME,
  appleWebApp: { title: "Mess Menu" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  other: { "msapplication-TileColor": "#da532c" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

// Student pages are static: built once and served straight from Cloudflare's
// CDN, with no per-request rendering (the free Workers plan allows only 10 ms
// of CPU per request). Their Content-Security-Policy uses hashes of the inline
// scripts, computed at build time by scripts/build-static-site.mjs.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  // Open the connection to the API (DNS, TCP, TLS: about a second from
  // Pakistan to the API's region) while the page's scripts are still loading.
  // "anonymous" matches the browser's credential-less CORS fetches.
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    preconnect(process.env.NEXT_PUBLIC_API_BASE_URL, { crossOrigin: "anonymous" });
  }

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <Providers>{children}</Providers>
        {/* The insights script only exists when deployed on Vercel */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
