/** Join class names, skipping falsy entries. */
export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/** Page frame: the footer sits at the bottom on short pages and follows the content on long ones. */
export const SHELL = "flex flex-col min-h-screen supports-[min-height:100dvh]:min-h-dvh";
export const SHELL_MAIN = "flex-[1_0_auto]";

/** Bootstrap's .container: full width, centred, stepped max-widths. */
export const CONTAINER =
  "w-full px-3 mx-auto min-[576px]:max-w-[540px] min-[768px]:max-w-[720px] min-[992px]:max-w-[960px] min-[1200px]:max-w-[1140px] min-[1400px]:max-w-[1320px]";

const ALERT = "relative p-4 mb-4 border rounded-[0.375rem]";
export const ALERT_INFO = `${ALERT} text-[#087990] bg-[#cff4fc] border-[#9eeaf9]`;
export const ALERT_DANGER = `${ALERT} text-[#b02a37] bg-[#f8d7da] border-[#f1aeb5]`;

/** Bootstrap's .btn.btn-primary */
export const BTN_PRIMARY =
  "inline-block px-3 py-1.5 text-[1rem] leading-[1.5] font-normal text-center align-middle no-underline select-none text-white bg-[#0d6efd] border border-[#0d6efd] rounded-[0.375rem] transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out hover:text-white hover:bg-[#0b5ed7] hover:border-[#0a58ca] focus-visible:outline-0 focus-visible:shadow-[0_0_0_0.25rem_rgba(49,132,253,0.5)] active:bg-[#0a58ca] active:border-[#0a53be]";

/** Full-screen dim backdrop for the login and announcement popups */
export const POPUP_OVERLAY = "fixed inset-0 z-[9999] flex justify-center items-center p-[10px] bg-black/60 animate-popup-fade";

/** Current / next meal badge (PKT) */
export const SLOT_BADGE_CLASS: Record<"now" | "next", string> = {
  now: "bg-[#9bb158] text-white",
  next: "bg-[#eef4dd] text-[#5f7530] border border-[#b9cc8a]",
};
export const SLOT_BADGE_BASE =
  "inline-block ml-2 px-[7px] py-px rounded-full text-[11px] font-bold tracking-[0.02em] normal-case align-middle whitespace-nowrap";
