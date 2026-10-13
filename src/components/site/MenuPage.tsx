"use client";

import { useEffect, type ReactNode } from "react";
import { fetchTodayMenu, fetchWeeklyMenu } from "@/lib/site/menuSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import AnnouncementPopup from "./AnnouncementPopup";
import Footer from "./Footer";
import Navbar from "./Navbar";
import ReportProblem from "./ReportProblem";
import TodayContainer from "./TodayContainer";
import WeekContainer from "./WeekContainer";
import { ALERT_DANGER, ALERT_INFO, BTN_PRIMARY, CONTAINER, SHELL, SHELL_MAIN } from "./shellClasses";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={SHELL}>
      <AnnouncementPopup />
      <Navbar />
      <main className={SHELL_MAIN}>{children}</main>
      <div className="shrink-0">
        <ReportProblem />
        <Footer />
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-center">
        <div
          className="inline-block w-12 h-12 align-[-0.125em] rounded-full border-[0.25em] border-current border-r-transparent text-[#9bb158] animate-spin-fast"
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-4">{label}</p>
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${CONTAINER} my-6`}>
      <div className={ALERT_DANGER} role="alert">
        <h4>Error loading menu</h4>
        <p>{message}</p>
        <button className={BTN_PRIMARY} onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className={`${CONTAINER} my-6`}>
      <div className={ALERT_INFO} role="alert">
        {label}
      </div>
    </div>
  );
}

export function TodayPage() {
  const dispatch = useAppDispatch();
  const { todayMenu, todayLoading, todayError } = useAppSelector((state) => state.menu);

  useEffect(() => {
    if (!todayMenu && !todayLoading && !todayError) dispatch(fetchTodayMenu());
  }, [todayMenu, todayLoading, todayError, dispatch]);

  if (todayError) {
    return (
      <Shell>
        <ErrorBox message={todayError} onRetry={() => dispatch(fetchTodayMenu())} />
      </Shell>
    );
  }
  if (!todayMenu) {
    return (
      <Shell>
        <Loading label="Loading today's menu..." />
      </Shell>
    );
  }
  if (!todayMenu.meals) {
    return (
      <Shell>
        <Empty label="No menu available for today." />
      </Shell>
    );
  }
  return (
    <Shell>
      <TodayContainer meals={todayMenu.meals} weekNumber={todayMenu.weekNumber} day={todayMenu.day} />
    </Shell>
  );
}

export function WeeklyPage() {
  const dispatch = useAppDispatch();
  const { weeklyMenu, weeklyLoading, weeklyError } = useAppSelector((state) => state.menu);

  useEffect(() => {
    if (!weeklyMenu && !weeklyLoading && !weeklyError) dispatch(fetchWeeklyMenu());
  }, [weeklyMenu, weeklyLoading, weeklyError, dispatch]);

  if (weeklyError) {
    return (
      <Shell>
        <ErrorBox message={weeklyError} onRetry={() => dispatch(fetchWeeklyMenu())} />
      </Shell>
    );
  }
  if (!weeklyMenu) {
    return (
      <Shell>
        <Loading label="Loading weekly menu..." />
      </Shell>
    );
  }
  if (!weeklyMenu.menu) {
    return (
      <Shell>
        <Empty label="No weekly menu available." />
      </Shell>
    );
  }
  return (
    <Shell>
      <WeekContainer weeklyMenu={weeklyMenu.menu} weekNumber={weeklyMenu.weekNumber} />
    </Shell>
  );
}
