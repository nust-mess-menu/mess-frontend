"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "./api";
import { banner, btn, cx, Icon, seg, segBtn, Spinner, ui } from "./ui";

interface PeriodStats {
  period: string;
  visitors: number;
  signedIn: number;
  ratings: number;
  reviews: number;
}

interface StatsReport {
  current: { day: string; week: string; month: string };
  daily: PeriodStats[];
  weekly: PeriodStats[];
  monthly: PeriodStats[];
  since: string | null;
  generatedAt: string;
}

type Range = "daily" | "weekly" | "monthly";

const RANGE_LABEL: Record<Range, string> = { daily: "Last 30 days", weekly: "Last 12 weeks", monthly: "Last 12 months" };

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

function periodLabel(range: Range, period: string, long = false): string {
  if (range === "monthly") return fmtDay(`${period}-01`, { month: long ? "long" : "short", year: long ? "numeric" : "2-digit" });
  if (range === "weekly") return `${long ? "Week of " : ""}${fmtDay(period, { day: "numeric", month: "short" })}`;
  return fmtDay(period, long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

const nf = new Intl.NumberFormat("en");

const CELL = "border-b border-adm-border px-3 py-[7px]";
const HEAD = "sticky top-0 bg-adm-surface-2 text-[12px] text-adm-text-2";

export default function StatsPanel() {
  const [report, setReport] = useState<StatsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("daily");
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (fresh: boolean) => {
    const res = await adminFetch<StatsReport>("stats", { query: fresh ? { fresh: "1" } : {} });
    if (!res.ok || !res.data) return { error: res.message || "Could not load stats." };
    return { data: res.data };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStats(false).then((r) => {
      if (cancelled) return;
      if ("data" in r && r.data) setReport(r.data);
      else setError(r.error ?? "Could not load stats.");
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStats]);

  const refresh = async () => {
    setRefreshing(true);
    const r = await fetchStats(true);
    setRefreshing(false);
    if ("data" in r && r.data) {
      setReport(r.data);
      setError(null);
    } else setError(r.error ?? "Could not load stats.");
  };

  if (error && !report) {
    return (
      <div className={banner("error")} role="alert">
        <Icon name="warning" /> {error}
      </div>
    );
  }
  if (!report) {
    return (
      <div className={ui.empty}>
        <Spinner label="Loading stats…" />
      </div>
    );
  }

  const today = report.daily.at(-1)!;
  const week = report.weekly.at(-1)!;
  const month = report.monthly.at(-1)!;
  const series = report[range];
  const max = Math.max(1, ...series.map((p) => p.visitors));
  const total = series.reduce((n, p) => n + p.visitors, 0);

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <div>
          <h2 className={ui.h2}>Usage</h2>
          <p className={ui.muted}>
            Unique visitors (each browser counts once per period), ratings and new reviews. Pakistan time.
            {report.since ? ` Tracking since ${fmtDay(report.since, { day: "numeric", month: "long", year: "numeric" })}.` : " No visits recorded yet."}
          </p>
        </div>
        <button type="button" className={btn("ghost", { sm: true })} onClick={refresh} disabled={refreshing}>
          {refreshing ? <Spinner /> : <Icon name="refresh" />} Refresh
        </button>
      </div>

      <div className="mb-[22px] grid grid-cols-3 gap-2.5 max-[700px]:grid-cols-1">
        <StatTile label="Today" stats={today} />
        <StatTile label="This week" stats={week} />
        <StatTile label="This month" stats={month} />
      </div>

      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2.5">
        <div>
          <h3 className="mb-0.5 text-[15px] font-bold">Unique visitors</h3>
          <p className={cx(ui.muted, "text-[12px]")}>
            {RANGE_LABEL[range]} · {nf.format(total)} {range === "daily" ? "visitor-days" : "total"}
          </p>
        </div>
        <div className={seg()} role="radiogroup" aria-label="Period">
          {(["daily", "weekly", "monthly"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              className={segBtn(range === r)}
              onClick={() => setRange(r)}
            >
              {r === "daily" ? "Days" : r === "weekly" ? "Weeks" : "Months"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid h-[220px] grid-cols-[auto_1fr] gap-2 pb-[22px]" role="img" aria-label={`Unique visitors, ${RANGE_LABEL[range].toLowerCase()}`}>
        <div
          className="flex flex-col justify-between text-right text-[11px] text-adm-text-3 tabular-nums"
          aria-hidden="true"
        >
          <span>{nf.format(max)}</span>
          <span>{nf.format(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex items-end gap-0.5 border-b border-adm-border-strong bg-[linear-gradient(var(--color-adm-border)_1px,transparent_1px)] [background-size:100%_50%]">
          {series.map((p, i) => {
            const last = series.length - 1;
            const isCurrent = i === last;
            // Daily: label every 7th day counting back from today, so labels never collide
            const showLabel = range !== "daily" || (last - i) % 7 === 0;
            // On phones, daily keeps only the first, middle and latest labels
            const hideOnPhone = range === "daily" && i !== 0 && i !== last && last - i !== 14;
            // Keep edge tooltips inside the chart
            const tipPos = i < 2 ? "left-0" : i > last - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div
                key={p.period}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                tabIndex={0}
              >
                <div
                  className={cx(
                    "min-h-0.5 w-full max-w-7 rounded-t-[4px] bg-[#7f9a3a] transition-opacity duration-[120ms]",
                    isCurrent ? "opacity-100" : "opacity-55 group-hover:opacity-100 group-focus-visible:opacity-100"
                  )}
                  style={{ height: `${(p.visitors / max) * 100}%` }}
                />
                <div
                  className={cx(
                    "pointer-events-none absolute bottom-[calc(100%+6px)] z-[3] hidden min-w-[150px] flex-col gap-px rounded-adm-sm bg-adm-ink px-2.5 py-2 text-[12px] text-[#f3f5ee] shadow-adm-lg",
                    "group-hover:bottom-[70%] group-hover:flex group-focus-visible:bottom-[70%] group-focus-visible:flex",
                    tipPos
                  )}
                  role="tooltip"
                >
                  <strong>{periodLabel(range, p.period, true)}</strong>
                  <span>{nf.format(p.visitors)} visitors</span>
                  <span>{nf.format(p.signedIn)} signed in</span>
                  <span>
                    {nf.format(p.ratings)} ratings · {nf.format(p.reviews)} reviews
                  </span>
                </div>
                <span className={cx("absolute -bottom-5 whitespace-nowrap text-[10px] text-adm-text-3", hideOnPhone && "max-[700px]:hidden")}>{showLabel ? periodLabel(range, p.period) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer font-semibold text-adm-accent-strong">Show as table</summary>
        <div className="mt-2.5 max-h-[360px] overflow-auto rounded-adm-sm border border-adm-border">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className={cx(CELL, HEAD, "text-left font-semibold")}>{range === "daily" ? "Day" : range === "weekly" ? "Week" : "Month"}</th>
                <th scope="col" className={cx(CELL, HEAD, "text-right")}>Visitors</th>
                <th scope="col" className={cx(CELL, HEAD, "text-right")}>Signed in</th>
                <th scope="col" className={cx(CELL, HEAD, "text-right")}>Ratings</th>
                <th scope="col" className={cx(CELL, HEAD, "text-right")}>New reviews</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((p) => (
                <tr key={p.period}>
                  <th scope="row" className={cx(CELL, "text-left font-semibold")}>{periodLabel(range, p.period, true)}</th>
                  <td className={cx(CELL, "text-right")}>{nf.format(p.visitors)}</td>
                  <td className={cx(CELL, "text-right")}>{nf.format(p.signedIn)}</td>
                  <td className={cx(CELL, "text-right")}>{nf.format(p.ratings)}</td>
                  <td className={cx(CELL, "text-right")}>{nf.format(p.reviews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function StatTile({ label, stats }: { label: string; stats: PeriodStats }) {
  return (
    <div className="rounded-adm-sm border border-adm-border bg-adm-surface-2 px-4 py-3.5">
      <p className={ui.eyebrow}>{label}</p>
      <p className="mt-1 mb-0.5 text-[30px] leading-[1.1] font-bold text-adm-text tabular-nums">{nf.format(stats.visitors)}</p>
      <p className="text-[12px] text-adm-text-2">visitors · {nf.format(stats.signedIn)} signed in</p>
      <p className="text-[12px] text-adm-text-2">
        {nf.format(stats.ratings)} ratings · {nf.format(stats.reviews)} reviews
      </p>
    </div>
  );
}
