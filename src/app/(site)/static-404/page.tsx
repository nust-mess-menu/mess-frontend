import NotFound from "../not-found";

// Static copy of the 404 page: scripts/build-static-site.mjs serves it as
// 404.html for unknown URLs on the static site
export const metadata = { title: { absolute: "Page not found - NUST Mess Menu" }, robots: { index: false } };

export default function StaticNotFound() {
  return <NotFound />;
}
