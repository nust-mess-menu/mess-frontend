/**
 * Public (browser-visible) configuration.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
 * nothing secret may ever live here. The Firebase web config is public by
 * design - access is controlled by Firebase Auth and the backend, not by
 * hiding these values.
 *
 * Each variable is referenced by its full literal name: Next.js only inlines
 * `process.env.NEXT_PUBLIC_X` when written out exactly like this.
 */

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function origin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (loopback || process.env.NODE_ENV !== "production"))) {
    throw new Error(`${name} must use https`);
  }
  return url.origin;
}

function authEmulator(apiBase: string): string {
  const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?.trim() || "";
  if (!host) return "";
  const apiHost = new URL(apiBase).hostname;
  // Only ever for local testing against a loopback backend
  if (process.env.NODE_ENV === "production" && apiHost !== "localhost" && apiHost !== "127.0.0.1") {
    throw new Error("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST must not be set for a real deployment");
  }
  return host;
}

const apiBaseUrl = origin(
  "NEXT_PUBLIC_API_BASE_URL",
  required("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL)
);

export const publicEnv = {
  apiBaseUrl,
  firebase: {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  },
  // Feedback widget; leave empty to disable it entirely
  userbackToken: process.env.NEXT_PUBLIC_USERBACK_TOKEN?.trim() || "",
  // Testing only: route sign-in to the Firebase Auth emulator (host:port).
  // Must never be set for a real deployment.
  authEmulatorHost: authEmulator(apiBaseUrl),
} as const;
