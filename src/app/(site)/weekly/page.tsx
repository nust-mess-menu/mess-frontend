import AboutSection from "@/components/site/AboutSection";
import { WeeklyPage } from "@/components/site/MenuPage";
import { fetchWeekSnapshot } from "@/lib/site/menuSnapshot";
import { pageMetadata } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "NUST Mess Menu This Week - Full Weekly Hostel Menu",
  description:
    "The NUST hostel mess menu for the whole week, Monday to Sunday: breakfast, lunch and dinner for every day, with timings, ratings and reviews.",
  path: "/weekly",
});

export default async function Weekly() {
  const week = await fetchWeekSnapshot();
  return <WeeklyPage about={<AboutSection week={week} />} />;
}
