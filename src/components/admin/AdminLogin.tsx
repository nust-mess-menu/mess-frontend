"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon, Spinner } from "./ui";

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
    <main className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/android-chrome-192x192.png" alt="" width={44} height={44} />
          <div>
            <p className="adm-eyebrow">NUST Mess Menu</p>
            <h1 className="adm-login-title">Admin sign in</h1>
          </div>
        </div>

        {notice && !error && <div className="adm-banner adm-banner--info">{notice}</div>}
        {error && (
          <div className="adm-banner adm-banner--error" role="alert">
            <Icon name="warning" /> {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="adm-form" noValidate>
          <div className="adm-field">
            <label className="adm-label" htmlFor="adm-username">
              Username
            </label>
            <input
              id="adm-username"
              className="adm-input"
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
          <div className="adm-field">
            <label className="adm-label" htmlFor="adm-password">
              Password
            </label>
            <div className="adm-input-group">
              <input
                id="adm-password"
                className="adm-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                maxLength={256}
                required
              />
              <button
                type="button"
                className="adm-iconbtn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} />
              </button>
            </div>
          </div>
          <button type="submit" className="adm-btn adm-btn--primary adm-btn--block" disabled={submitting || !username || !password}>
            {submitting ? <Spinner /> : null}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="adm-login-foot">
          Sessions last 8 hours. Repeated failed attempts are temporarily blocked.
        </p>
      </div>
    </main>
  );
}
