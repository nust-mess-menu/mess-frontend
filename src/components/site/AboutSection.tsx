import Link from "next/link";
import { CONTAINER } from "./shellClasses";

const CELL = "px-3 py-[6px] border-b border-[#e3e6ea] text-left";

/**
 * Static text below the menu. The menu itself loads in the browser, so this
 * is what the prerendered HTML says about the page before any data arrives.
 * Collapsed by default: search engines index the content of a closed
 * <details>, whereas text hidden outright counts as hidden-text spam.
 * Timings match the Today and This Week views.
 */
export default function AboutSection() {
  return (
    <details className={`${CONTAINER} max-w-[860px]! mt-2 mb-2 text-[0.85rem] leading-[1.6] text-[#5c646f]`}>
      <summary className="w-fit mx-auto mb-2 text-[0.78rem] text-[#8b939d] cursor-pointer select-none hover:text-[#5c646f]">
        About &amp; mess timings
      </summary>
      <h2 className="mb-2 text-left text-[1rem] font-semibold text-[#30363d]">
        About NUST Mess Menu
      </h2>
      <p className="mb-3">
        NUST Mess Menu shows the mess menu for NUST hostels: what&apos;s for breakfast, lunch and dinner{" "}
        <Link href="/">today</Link> and the <Link href="/weekly">full menu for this week</Link>. Students can rate
        meals, read reviews from other students and report when the food served doesn&apos;t match the menu.
      </p>
      <h2 className="mb-2 text-left text-[1rem] font-semibold text-[#30363d]">Mess timings</h2>
      <table className="w-full max-w-[520px] border-collapse">
        <thead>
          <tr className="text-[#30363d]">
            <th scope="col" className={CELL}>Meal</th>
            <th scope="col" className={CELL}>Monday - Friday</th>
            <th scope="col" className={CELL}>Saturday - Sunday</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={CELL}>Breakfast</th>
            <td className={CELL}>7:30 - 9:30 AM</td>
            <td className={CELL}>9:00 - 10:30 AM</td>
          </tr>
          <tr>
            <th scope="row" className={CELL}>Lunch</th>
            <td className={CELL}>1:00 - 3:30 PM</td>
            <td className={CELL}>2:00 - 3:30 PM</td>
          </tr>
          <tr>
            <th scope="row" className={CELL}>Dinner</th>
            <td className={CELL}>7:30 - 9:30 PM</td>
            <td className={CELL}>7:30 - 9:30 PM</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}
