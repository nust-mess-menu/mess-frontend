"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { banner, btn, iconBtn, Icon, input, Spinner, ui } from "./ui";

export default function AdminLogin() {
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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Sign-in failed. Please try again.");
      setPassword("");
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

        {notice && !error && <div className={banner("info")}>{notice}</div>}
        {error && (
          <div className={banner("error")} role="alert" data-testid="login-error">
            <Icon name="warning" /> {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
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
          <button type="submit" className={btn("primary", { block: true })} disabled={submitting || !username || !password}>
            {submitting ? <Spinner /> : null}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-[18px] text-center text-[12px] text-adm-text-3">
          Sessions last 8 hours. Repeated failed attempts are temporarily blocked.
        </p>
      </div>
    </main>
  );
}
