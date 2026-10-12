import { notFound } from "next/navigation";

// Any URL without a route renders the site-styled 404 below (inside the site
// layout, so it gets the same navbar and a CSP nonce like every other page)
export default function Missing() {
  notFound();
}
