import type { NextConfig } from "next";

/**
 * Static security headers. The Content-Security-Policy is per-request (it
 * carries a nonce) and is set in src/proxy.ts instead.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Google sign-in uses a popup that must be able to message this window back
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // Self-contained server bundle for small Docker images
  output: "standalone",
  // /daily was a copy of the home page; the static site redirects it the same
  // way (_redirects, written by scripts/build-static-site.mjs)
  async redirects() {
    return [{ source: "/daily", destination: "/", permanent: true }];
  },
  async headers() {
    // Public files are not content-hashed, so they get a day of caching plus a
    // week of stale-while-revalidate (build assets under /_next/static are
    // hashed and Next.js already marks them immutable). HTML is never cached:
    // every page carries a per-request CSP nonce.
    const publicAsset = [
      { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/avatars/:path*", headers: publicAsset },
      { source: "/images/:path*", headers: publicAsset },
      {
        source: "/:file(favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-384x384.png|mstile-150x150.png|og-image.png|site.webmanifest|browserconfig.xml|robots.txt|sitemap.xml|llms.txt)",
        headers: publicAsset,
      },
      {
        // Admin pages and the BFF API: never cached, never indexed
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
