import { TodayPage } from "@/components/site/MenuPage";
import { pageMetadata, websiteJsonLd } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "NUST Mess Menu - Today's Hostel Breakfast, Lunch & Dinner",
  description:
    "Today's NUST hostel mess menu: breakfast, lunch and dinner with serving timings, meal ratings and student reviews. Plus the full weekly menu.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
      />
      <TodayPage />
    </>
  );
}
