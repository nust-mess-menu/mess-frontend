"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { banner, btn, iconBtn, Icon, input, Spinner, ui } from "./ui";

const fmtUnlock = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** `initialLockedUntil`: set when sign-in is locked (more than 5 wrong passwords in 24 hours) */
export default function AdminLogin({ initialLockedUntil = null }: { initialLockedUntil?: string | null }) {
  const [lockedUntil, setLockedUntil] = useState<string | null>(initialLockedUntil);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = useSearchParams().get("expired") ? "Your session ended. Please sign in again." : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // Wipe the password from memory, then do a full navigation so no
        // pre-login client state survives into the console
        setPassword("");
        window.location.replace("/admin");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string; lockedUntil?: string };
      setPassword("");
      if (res.status === 423 && data.lockedUntil) {
        setLockedUntil(data.lockedUntil);
        return;
      }
      setError(data.message || "Sign-in failed. Please try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 [background:radial-gradient(1200px_500px_at_50%_-10%,#e9efd8,transparent),var(--color-adm-bg)]">
      <div className="w-full max-w-[400px] rounded-[14px] border border-adm-border bg-adm-surface p-7 shadow-adm">
        <div className="mb-[22px] flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/android-chrome-192x192.png" alt="" width={44} height={44} className="rounded-[10px]" />
          <div>
            <p className={ui.eyebrow}>NUST Mess Menu</p>
            <h1 className="mt-0.5 text-[22px] font-bold">Admin sign in</h1>
          </div>
        </div>

        {lockedUntil && (
          <div className={banner("error")} role="alert" data-testid="login-locked">
            <Icon name="warning" />
            <div className="grid gap-1.5">
              <strong>Admin sign-in is locked for 24 hours.</strong>
              <span>
                Too many wrong passwords. It unlocks on <strong>{fmtUnlock(lockedUntil)}</strong> (Pakistan time); reload
                this page after that.
              </span>
              <span>
                To unlock sooner, delete <code className={ui.code}>config/admin-lock</code> in the Firebase console, or run{" "}
                <code className={ui.code}>npm run admin:unlock</code> in mess-backend.
              </span>
            </div>
          </div>
        )}
        {notice && !error && !lockedUntil && <div className={banner("info")}>{notice}</div>}
        {error && !lockedUntil && (
          <div className={banner("error")} role="alert" data-testid="login-error">
            <Icon name="warning" /> {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <fieldset disabled={Boolean(lockedUntil)} className="m-0 grid gap-4 border-0 p-0 disabled:opacity-60">
            <div className={ui.fieldInForm}>
              <label className={ui.label} htmlFor="admin-username">
                Username
              </label>
              <input
                id="admin-username"
                className={input()}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={128}
                required
                autoFocus
              />
            </div>
            <div className={ui.fieldInForm}>
              <label className={ui.label} htmlFor="admin-password">
                Password
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="admin-password"
                  className={input()}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  maxLength={256}
                  required
                />
                <button
                  type="button"
                  className={iconBtn()}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </div>
            </div>
            <button type="submit" className={btn("primary", { block: true })} disabled={submitting || !username || !password || Boolean(lockedUntil)}>
              {submitting ? <Spinner /> : null}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </fieldset>
        </form>

        <p className="mt-[18px] text-center text-[12px] text-adm-text-3">
          Sessions last 8 hours. More than 5 wrong passwords lock sign-in for 24 hours.
        </p>
      </div>
    </main>
  );
}
