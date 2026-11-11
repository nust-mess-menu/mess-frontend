import AboutSection from "@/components/site/AboutSection";
import { TodayPage } from "@/components/site/MenuPage";
import { fetchTodaySnapshot } from "@/lib/site/menuSnapshot";
import { pageMetadata, websiteJsonLd } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "NUST Mess Menu - Today's Hostel Breakfast, Lunch & Dinner",
  description:
    "Today's NUST hostel mess menu: breakfast, lunch and dinner with serving timings, meal ratings and student reviews. Plus the full weekly menu.",
  path: "/",
});

export default async function Home() {
  const today = await fetchTodaySnapshot();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
      />
      <TodayPage about={<AboutSection today={today} />} />
    </>
  );
}
