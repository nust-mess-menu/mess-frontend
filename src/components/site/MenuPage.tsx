"use client";

import { useEffect, type ReactNode } from "react";
import { fetchTodayMenu, fetchWeeklyMenu } from "@/lib/site/menuSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import AnnouncementPopup from "./AnnouncementPopup";
import Footer from "./Footer";
import Navbar from "./Navbar";
import TodayContainer from "./TodayContainer";
import WeekContainer from "./WeekContainer";

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementPopup />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
      <div className="text-center">
        <div className="spinner-border" role="status" style={{ color: "#9bb158", width: "3rem", height: "3rem" }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">{label}</p>
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="container my-4">
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Error loading menu</h4>
        <p>{message}</p>
        <button className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="container my-4">
      <div className="alert alert-info" role="alert">
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
