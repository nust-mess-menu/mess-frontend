"use client";

import { getApps, initializeApp, type FirebaseApp } from "@firebase/app";
import { connectAuthEmulator, getAuth, type Auth, type User } from "@firebase/auth";
import { publicEnv } from "@/lib/publicEnv";

/**
 * Firebase is initialised lazily, on first use in the browser, so server
 * rendering never touches it. Only Authentication is used - Google sign-in.
 */
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is browser-only");
  }
  if (!auth) {
    app = getApps()[0] ?? initializeApp(publicEnv.firebase);
    auth = getAuth(app);
    if (publicEnv.authEmulatorHost) {
      connectAuthEmulator(auth, `http://${publicEnv.authEmulatorHost}`, { disableWarnings: true });
    }
  }
  return auth;
}

/**
 * Resolve the current Firebase user, waiting for the SDK to restore its session.
 *
 * `auth.currentUser` is null until Firebase finishes reading its stored session,
 * which happens asynchronously after page load. Returns null once auth has
 * genuinely settled with nobody signed in.
 */
export function waitForFirebaseUser(timeoutMs = 5000): Promise<User | null> {
  const a = firebaseAuth();
  if (a.currentUser) return Promise.resolve(a.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    const cleanups: Array<() => void> = [];

    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      resolve(user);
    };

    const timer = setTimeout(() => finish(a.currentUser ?? null), timeoutMs);
    cleanups.push(() => clearTimeout(timer));
    const unsubscribe = a.onAuthStateChanged(
      (user) => finish(user),
      () => finish(null)
    );
    // onAuthStateChanged can fire synchronously; unsubscribe immediately if so
    if (settled) unsubscribe();
    else cleanups.push(unsubscribe);
  });
}

/** Fresh ID token for the signed-in user, or null if there is no session. Never throws. */
export async function getIdTokenSafely(): Promise<string | null> {
  try {
    const user = await waitForFirebaseUser();
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}
