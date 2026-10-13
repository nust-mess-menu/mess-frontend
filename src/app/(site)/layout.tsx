import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { preconnect } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/site/Providers";

import "@/styles/site.css";

// Self-hosted at build time: no request to Google Fonts from the browser.
// Regular weight only, exactly like the original's Google Fonts link.
const inter = Inter({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Mess Menu - NUST Hostels",
  description: "Today's and this week's mess menu for NUST hostels, with ratings and reviews.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
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

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts every page into dynamic rendering, which the
  // nonce-based Content-Security-Policy requires (Next.js applies the nonce
  // to its own scripts; third-party scripts load via 'strict-dynamic')
  await headers();

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
