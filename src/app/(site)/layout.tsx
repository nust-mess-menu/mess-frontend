import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/site/Providers";

// Same stylesheet order as the original app: Bootstrap, then app CSS
import "@/styles/site.css";
import "@/styles/vendor/bootstrap-5.3.0-alpha1.min.css";
import "@/styles/site/fonts.css";
import "@/styles/site/index.css";
import "@/styles/site/app.css";
import "@/styles/site/navbar.css";
import "@/styles/site/todayContainer.css";
import "@/styles/site/mealModal.css";
import "@/styles/site/comments.css";
import "@/styles/site/WeekContainer.css";
import "@/styles/site/popups.css";
import "@/styles/site/reportProblem.css";
import "@/styles/site/report.css";

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
