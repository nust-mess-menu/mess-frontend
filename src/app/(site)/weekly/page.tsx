import type { Metadata } from "next";
import { WeeklyPage } from "@/components/site/MenuPage";

export const metadata: Metadata = {
  title: "This Week - Mess Menu - NUST Hostels",
  alternates: { canonical: "/weekly" },
};

export default function Weekly() {
  return <WeeklyPage />;
}
