import { WeeklyPage } from "@/components/site/MenuPage";
import { pageMetadata } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "NUST Mess Menu This Week - Full Weekly Hostel Menu",
  description:
    "The NUST hostel mess menu for the whole week, Monday to Sunday: breakfast, lunch and dinner for every day, with timings, ratings and reviews.",
  path: "/weekly",
});

export default function Weekly() {
  return <WeeklyPage />;
}
