"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "./api";
import { Icon, Spinner } from "./ui";

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
      <div className="adm-banner adm-banner--error" role="alert">
        <Icon name="warning" /> {error}
      </div>
    );
  }
  if (!report) {
    return (
      <div className="adm-loading">
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
    <section className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-h2">Usage</h2>
          <p className="adm-muted">
            Unique visitors (each browser counts once per period), ratings and new reviews. Pakistan time.
            {report.since ? ` Tracking since ${fmtDay(report.since, { day: "numeric", month: "long", year: "numeric" })}.` : " No visits recorded yet."}
          </p>
        </div>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Spinner /> : <Icon name="refresh" />} Refresh
        </button>
      </div>

      <div className="adm-stat-tiles">
        <StatTile label="Today" stats={today} />
        <StatTile label="This week" stats={week} />
        <StatTile label="This month" stats={month} />
      </div>

      <div className="adm-chart-head">
        <div>
          <h3 className="adm-chart-title">Unique visitors</h3>
          <p className="adm-muted">
            {RANGE_LABEL[range]} · {nf.format(total)} {range === "daily" ? "visitor-days" : "total"}
          </p>
        </div>
        <div className="adm-seg" role="radiogroup" aria-label="Period">
          {(["daily", "weekly", "monthly"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              className={`adm-seg-btn ${range === r ? "is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r === "daily" ? "Days" : r === "weekly" ? "Weeks" : "Months"}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-chart" role="img" aria-label={`Unique visitors, ${RANGE_LABEL[range].toLowerCase()}`}>
        <div className="adm-chart-grid" aria-hidden="true">
          <span>{nf.format(max)}</span>
          <span>{nf.format(Math.round(max / 2))}</span>
          <span>0</span>
        </div>
        <div className={`adm-bars adm-bars--${range}`}>
          {series.map((p, i) => {
            const isCurrent = i === series.length - 1;
            // Daily: label every 7th day counting back from today, so labels never collide
            const showLabel = range !== "daily" || (series.length - 1 - i) % 7 === 0;
            return (
              <div key={p.period} className="adm-bar-slot" tabIndex={0}>
                <div
                  className={`adm-bar ${isCurrent ? "is-current" : ""}`}
                  style={{ height: `${(p.visitors / max) * 100}%` }}
                />
                <div className="adm-bar-tip" role="tooltip">
                  <strong>{periodLabel(range, p.period, true)}</strong>
                  <span>{nf.format(p.visitors)} visitors</span>
                  <span>{nf.format(p.signedIn)} signed in</span>
                  <span>
                    {nf.format(p.ratings)} ratings · {nf.format(p.reviews)} reviews
                  </span>
                </div>
                <span className="adm-bar-label">{showLabel ? periodLabel(range, p.period) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      <details className="adm-stat-table">
        <summary>Show as table</summary>
        <div className="adm-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{range === "daily" ? "Day" : range === "weekly" ? "Week" : "Month"}</th>
                <th scope="col">Visitors</th>
                <th scope="col">Signed in</th>
                <th scope="col">Ratings</th>
                <th scope="col">New reviews</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((p) => (
                <tr key={p.period}>
                  <th scope="row">{periodLabel(range, p.period, true)}</th>
                  <td>{nf.format(p.visitors)}</td>
                  <td>{nf.format(p.signedIn)}</td>
                  <td>{nf.format(p.ratings)}</td>
                  <td>{nf.format(p.reviews)}</td>
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
    <div className="adm-stat-tile">
      <p className="adm-eyebrow">{label}</p>
      <p className="adm-stat-value">{nf.format(stats.visitors)}</p>
      <p className="adm-stat-sub">visitors · {nf.format(stats.signedIn)} signed in</p>
      <p className="adm-stat-sub">
        {nf.format(stats.ratings)} ratings · {nf.format(stats.reviews)} reviews
      </p>
    </div>
  );
}
