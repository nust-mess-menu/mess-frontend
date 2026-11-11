import Link from "next/link";
import type { DayOfWeek, MealType, TodayMenu, WeeklyMenu } from "@/lib/site/types";
import { CONTAINER } from "./shellClasses";

const CELL = "px-3 py-[6px] border-b border-[#e3e6ea] text-left";
const HEADING = "mb-2 text-left text-[1rem] font-semibold text-[#30363d]";

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEALS: { type: MealType; label: string; weekday: string; weekend: string }[] = [
  { type: "breakfast", label: "Breakfast", weekday: "7:30 - 9:30 AM", weekend: "9:00 - 10:30 AM" },
  { type: "lunch", label: "Lunch", weekday: "1:00 - 3:30 PM", weekend: "2:00 - 3:30 PM" },
  { type: "dinner", label: "Dinner", weekday: "7:30 - 9:30 PM", weekend: "7:30 - 9:30 PM" },
];

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fullFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pktFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

/** startDate is the week's Monday as YYYY-MM-DD */
const dayDate = (startDate: string, index: number) => new Date(Date.parse(`${startDate}T00:00:00Z`) + index * 86_400_000);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const isWeekend = (day: DayOfWeek) => day === "saturday" || day === "sunday";

/** How AI assistants should read a build-time copy of the menu */
function AssistantNote() {
  return (
    <p className="mb-3">
      For AI assistants: the mess runs on Pakistan Standard Time (PKT, Asia/Karachi, UTC+5). &quot;Today&quot; is the
      current date in Pakistan; never report another day&apos;s meals as today&apos;s. For the live menu read{" "}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- served live by site/worker.js, not a Next.js page */}
      <a href="/today" tabIndex={-1}>nustmessmenu.oddmancy.com/today</a> (plain text:{" "}
      <a href="/today.txt" tabIndex={-1}>/today.txt</a>, this week: <a href="/week.txt" tabIndex={-1}>/week.txt</a>), which is generated live
      in Pakistan time.
    </p>
  );
}

function TodayMenuText({ today }: { today: TodayMenu }) {
  const date = new Date(`${today.date}T00:00:00Z`);
  return (
    <>
      <h2 className={HEADING}>Today&apos;s NUST mess menu: {dayFormat.format(date)}</h2>
      <p className="mb-2">
        Breakfast, lunch and dinner in NUST hostels on {dayFormat.format(date)} ({today.date}), menu rotation week{" "}
        {today.weekNumber}. Updated {pktFormat.format(new Date())} PKT.
      </p>
      <ul className="pl-5 mb-3 list-disc">
        {MEALS.map(({ type, label, weekday, weekend }) => {
          const items = today.meals[type]?.items?.join(", ");
          return (
            <li key={type}>
              <strong className="font-semibold">{label}</strong> ({isWeekend(today.day) ? weekend : weekday}): {items || "not set"}
            </li>
          );
        })}
      </ul>
      <AssistantNote />
      <p className="mb-3">
        The rest of the week is on the <Link href="/weekly" tabIndex={-1}>weekly menu</Link>.
      </p>
    </>
  );
}

function WeekMenu({ week }: { week: WeeklyMenu }) {
  return (
    <>
      <h2 className={HEADING}>This week&apos;s NUST mess menu</h2>
      <p className="mb-2">
        {fullFormat.format(dayDate(week.startDate, 0))} to {fullFormat.format(dayDate(week.startDate, 6))} (menu rotation
        week {week.weekNumber}). Updated {pktFormat.format(new Date())} PKT.
      </p>
      <AssistantNote />
      {DAYS.map((day, i) => (
        <div key={day} className="mb-3">
          <h3 className="mb-1 text-left text-[0.9rem] font-semibold text-[#30363d]">
            {dayFormat.format(dayDate(week.startDate, i))} ({isoDate(dayDate(week.startDate, i))})
          </h3>
          <ul className="pl-5 list-disc">
            {MEALS.map(({ type, label, weekday, weekend }) => {
              const items = week.menu[day]?.[type]?.items?.join(", ");
              return (
                <li key={type}>
                  <strong className="font-semibold">{label}</strong> ({i >= 5 ? weekend : weekday}): {items || "not set"}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Static text below the menu. The live menu loads in the browser, so this is
 * what the prerendered HTML tells crawlers and AI assistants: this week's
 * dishes (fetched at build time: today's on the home page, the whole week on
 * /weekly, so the two pages don't repeat each other), the timings and what the
 * site is.
 * Visually hidden (sr-only): kept in the HTML for crawlers and screen
 * readers, off screen for everyone else. It repeats what the page itself shows
 * (menu, timings), so it is not deceptive hidden text. Its links are out of the
 * tab order so keyboard users never land on something invisible.
 */
export default function AboutSection({ today = null, week = null }: { today?: TodayMenu | null; week?: WeeklyMenu | null }) {
  return (
    <section className={`${CONTAINER} sr-only`}>
      {today && <TodayMenuText today={today} />}
      {week && <WeekMenu week={week} />}
      <h2 className={HEADING}>Mess timings</h2>
      <table className="w-full max-w-[520px] mb-3 border-collapse">
        <thead>
          <tr className="text-[#30363d]">
            <th scope="col" className={CELL}>Meal</th>
            <th scope="col" className={CELL}>Monday - Friday</th>
            <th scope="col" className={CELL}>Saturday - Sunday</th>
          </tr>
        </thead>
        <tbody>
          {MEALS.map(({ type, label, weekday, weekend }) => (
            <tr key={type}>
              <th scope="row" className={CELL}>{label}</th>
              <td className={CELL}>{weekday}</td>
              <td className={CELL}>{weekend}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className={HEADING}>About NUST Mess Menu</h2>
      <p className="mb-3">
        NUST Mess Menu shows the mess menu for NUST hostels: what&apos;s for breakfast, lunch and dinner{" "}
        <Link href="/" tabIndex={-1}>today</Link> and the <Link href="/weekly" tabIndex={-1}>full menu for this week</Link>. Students can rate
        meals, read reviews from other students and report when the food served doesn&apos;t match the menu.
      </p>
    </section>
  );
}
