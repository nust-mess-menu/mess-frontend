"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "./api";
import BulkEditor from "./BulkEditor";
import MealLibrary from "./MealLibrary";
import MenuBoard from "./MenuBoard";
import SpotlightPanel from "./SpotlightPanel";
import StatsPanel from "./StatsPanel";
import { DAYS, MEAL_TYPES, type Meal, type SlotRef, type Week, type WeekDishes, type WeekIds } from "./types";
import { banner, btn, ConfirmDialog, cx, Icon, Spinner, ToastProvider, ui, useToast } from "./ui";

type Tab = "menu" | "library" | "bulk" | "stats" | "spotlight";

export interface AdminData {
  currentWeek: Week;
  ids: Record<Week, WeekIds>;
  dishes: Record<Week, WeekDishes>;
  meals: Meal[];
}

type LoadResult = { data: AdminData } | { error: string };

async function fetchAdminData(): Promise<LoadResult> {
  const [week, ids, dishes, meals] = await Promise.all([
    adminFetch<{ currentWeek: Week }>("week"),
    adminFetch<{ week1: WeekIds; week2: WeekIds }>("menu/bulk"),
    adminFetch<{ week1: WeekDishes; week2: WeekDishes }>("menu"),
    adminFetch<{ meals: Meal[] }>("meals"),
  ]);
  const failed = [week, ids, dishes, meals].find((r) => !r.ok);
  if (failed) return { error: failed.message || "Could not load the menu." };
  return {
    data: {
      currentWeek: week.data!.currentWeek === 2 ? 2 : 1,
      ids: { 1: ids.data!.week1, 2: ids.data!.week2 },
      dishes: { 1: dishes.data!.week1, 2: dishes.data!.week2 },
      meals: Array.isArray(meals.data!.meals) ? meals.data!.meals : [],
    },
  };
}

export default function AdminDashboard({ sessionExpiresAt }: { sessionExpiresAt: string }) {
  return (
    <ToastProvider>
      <Dashboard sessionExpiresAt={sessionExpiresAt} />
    </ToastProvider>
  );
}

function Dashboard({ sessionExpiresAt }: { sessionExpiresAt: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("menu");
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const apply = useCallback((result: LoadResult) => {
    if ("error" in result) {
      setLoadError(result.error);
      return;
    }
    setLoadError(null);
    setData(result.data);
  }, []);

  // Manual reload (button, and after every successful change)
  const load = useCallback(async () => {
    setRefreshing(true);
    const result = await fetchAdminData();
    setRefreshing(false);
    apply(result);
  }, [apply]);

  // Initial load: state is only set once the requests resolve
  useEffect(() => {
    let cancelled = false;
    fetchAdminData().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Send the admin back to sign-in the moment the session runs out
  useEffect(() => {
    const ms = new Date(sessionExpiresAt).getTime() - Date.now();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    const timer = setTimeout(() => window.location.assign("/admin/login?expired=1"), Math.max(0, ms));
    return () => clearTimeout(timer);
  }, [sessionExpiresAt]);

  const usage = useMemo(() => {
    const map = new Map<string, SlotRef[]>();
    if (!data) return map;
    for (const week of [1, 2] as Week[]) {
      for (const day of DAYS) {
        for (const mealType of MEAL_TYPES) {
          const id = data.ids[week]?.[day]?.[mealType];
          if (!id) continue;
          map.set(id, [...(map.get(id) ?? []), { week, day, mealType }]);
        }
      }
    }
    return map;
  }, [data]);

  const switchWeek = async () => {
    setSwitching(true);
    const res = await adminFetch<{ newWeek: Week }>("week", { method: "POST" });
    setSwitching(false);
    setConfirmSwitch(false);
    if (!res.ok) {
      toast("error", res.message || "Could not switch week.");
      return;
    }
    toast("success", `Week ${res.data!.newWeek} is now live for students.`);
    setData((d) => (d ? { ...d, currentWeek: res.data!.newWeek } : d));
  };

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    window.location.replace("/admin/login");
  };

  const expiresLabel = new Date(sessionExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
  const otherWeek: Week = data?.currentWeek === 1 ? 2 : 1;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-adm-border bg-white/92 backdrop-blur-[8px] backdrop-saturate-[1.4]">
        <div className="mx-auto flex min-h-[58px] max-w-[1200px] items-center justify-between gap-3 px-5 max-[600px]:px-3.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/android-chrome-192x192.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-[15px] font-bold">Mess Menu</span>
            <span className="rounded-full bg-adm-accent-soft px-2 py-0.5 text-[11px] font-bold text-adm-accent-strong">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[12px] text-adm-text-3 max-[600px]:hidden" title="Sessions last 8 hours">
              Session until {expiresLabel}
            </span>
            <a className={btn("ghost", { sm: true })} href="/" target="_blank" rel="noopener noreferrer">
              <Icon name="external" /> <span className="max-[600px]:hidden">View site</span>
            </a>
            <button type="button" className={btn("ghost", { sm: true })} onClick={signOut} disabled={signingOut}>
              <Icon name="logout" /> <span className="max-[600px]:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 pt-6 pb-12 max-[600px]:px-3.5">
        <section className="mb-5 flex items-end justify-between gap-4 max-[900px]:flex-col max-[900px]:items-stretch">
          <div>
            <h1 className="mb-1 text-[24px] font-bold tracking-[-0.01em]">Menu management</h1>
            <p className="text-adm-text-2">The menu rotates between two weeks. Edits go live for students immediately.</p>
          </div>
          <div
            className="flex items-center gap-[18px] rounded-adm border border-adm-border bg-adm-surface py-3 pr-3.5 pl-[18px] shadow-adm max-[900px]:justify-between"
            aria-live="polite"
          >
            <div>
              <p className={ui.eyebrow}>Live this week</p>
              <p className="text-[22px] font-bold text-adm-accent-strong" data-testid="live-week">{data ? `Week ${data.currentWeek}` : "—"}</p>
            </div>
            <button
              type="button"
              className={btn("secondary")}
              onClick={() => setConfirmSwitch(true)}
              disabled={!data || switching}
            >
              <Icon name="swap" /> Switch to Week {otherWeek}
            </button>
          </div>
        </section>

        <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-adm-border" role="tablist" aria-label="Admin sections">
          {(
            [
              ["menu", "calendar", "Weekly menu"],
              ["library", "library", `Meal library${data ? ` (${data.meals.length})` : ""}`],
              ["bulk", "code", "Bulk editor"],
              ["stats", "chart", "Stats"],
              ["spotlight", "megaphone", "Spotlight"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={cx(
                "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 bg-transparent px-3.5 py-2.5 font-semibold",
                tab === key ? "border-adm-accent text-adm-accent-strong" : "border-transparent text-adm-text-2 hover:text-adm-text"
              )}
              onClick={() => setTab(key)}
            >
              <Icon name={icon} /> {label}
            </button>
          ))}
          <button
            type="button"
            className={btn("ghost", { sm: true, className: "ml-auto" })}
            onClick={load}
            disabled={refreshing}
            aria-label="Reload data"
          >
            {refreshing ? <Spinner /> : <Icon name="refresh" />} <span className="max-[600px]:hidden">Reload</span>
          </button>
        </nav>

        {loadError && (
          <div className={banner("error")} role="alert">
            <Icon name="warning" /> {loadError}
            <button type="button" className={btn("ghost", { sm: true, className: "ml-auto" })} onClick={load}>
              Try again
            </button>
          </div>
        )}

        {!data && !loadError && (
          <div className={ui.empty}>
            <Spinner label="Loading menu…" />
          </div>
        )}

        {data && (
          <div role="tabpanel">
            {tab === "menu" && <MenuBoard data={data} onChanged={load} />}
            {tab === "library" && <MealLibrary meals={data.meals} usage={usage} onChanged={load} />}
            {tab === "bulk" && <BulkEditor currentIds={data.ids} onChanged={load} />}
            {tab === "stats" && <StatsPanel />}
            {tab === "spotlight" && <SpotlightPanel />}
          </div>
        )}
      </main>

      {confirmSwitch && data && (
        <ConfirmDialog
          title={`Switch to Week ${otherWeek}?`}
          body={
            <p>
              Students will immediately see the <strong>Week {otherWeek}</strong> menu on the Today and This Week pages.
              The weekly cron job will keep alternating from there.
            </p>
          }
          confirmLabel={`Switch to Week ${otherWeek}`}
          busy={switching}
          onConfirm={switchWeek}
          onCancel={() => setConfirmSwitch(false)}
        />
      )}
    </div>
  );
}
