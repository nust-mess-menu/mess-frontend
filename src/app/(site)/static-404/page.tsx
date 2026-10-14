import NotFound from "../not-found";

// Static copy of the 404 page: scripts/build-static-site.mjs serves it as
// 404.html for unknown URLs on the static site
export const metadata = { title: "Page not found - Mess Menu - NUST Hostels", robots: { index: false } };

export default function StaticNotFound() {
  return <NotFound />;
}
